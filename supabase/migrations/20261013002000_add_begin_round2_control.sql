-- ====================================================================
-- NEMESIS: ADD 'BEGIN ROUND 2' SYSTEM CONTROL
-- Controls visibility of Round 2 teams and directives.
-- Players cannot see any Round 2 team details until the Admin activates Round 2.
-- ====================================================================

-- 1. Create round2_settings table for global round 2 state
CREATE TABLE IF NOT EXISTS public.round2_settings (
  id text PRIMARY KEY DEFAULT 'global_config',
  is_round2_active boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.round2_settings (id, is_round2_active)
VALUES ('global_config', false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.round2_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_anon_read_round2_settings" ON public.round2_settings;
CREATE POLICY "allow_anon_read_round2_settings" ON public.round2_settings
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "deny_anon_write_round2_settings" ON public.round2_settings;
CREATE POLICY "deny_anon_write_round2_settings" ON public.round2_settings
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 2. Admin RPC to toggle Round 2 active status (Begin / Pause)
CREATE OR REPLACE FUNCTION public.set_round2_active(
  admin_pwd text,
  p_active boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  pwd_hash text;
BEGIN
  -- Authenticate admin
  SELECT password_hash INTO pwd_hash FROM public.admin_config LIMIT 1;
  IF pwd_hash IS NULL OR extensions.crypt(admin_pwd, pwd_hash) != pwd_hash THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  INSERT INTO public.round2_settings (id, is_round2_active, started_at, updated_at)
  VALUES ('global_config', p_active, CASE WHEN p_active THEN now() ELSE NULL END, now())
  ON CONFLICT (id) DO UPDATE
  SET is_round2_active = EXCLUDED.is_round2_active,
      started_at = CASE WHEN EXCLUDED.is_round2_active THEN now() ELSE public.round2_settings.started_at END,
      updated_at = now();

  RETURN json_build_object(
    'success', true,
    'is_round2_active', p_active
  );
END;
$$;

-- 3. Public RPC to inspect Round 2 status
CREATE OR REPLACE FUNCTION public.get_round2_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_active boolean := false;
  v_started_at timestamptz;
BEGIN
  SELECT is_round2_active, started_at INTO v_active, v_started_at
  FROM public.round2_settings
  WHERE id = 'global_config'
  LIMIT 1;

  RETURN json_build_object(
    'is_round2_active', COALESCE(v_active, false),
    'started_at', v_started_at
  );
END;
$$;

-- 4. Update get_round2_teams_data (for Admin) to include is_round2_active
CREATE OR REPLACE FUNCTION public.get_round2_teams_data(admin_pwd text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  pwd_hash text;
  v_teams json;
  v_unassigned json;
  v_total_players integer;
  v_formed_teams_count integer;
  v_assigned_players_count integer;
  v_unassigned_players_count integer;
  v_ann public.round2_announcements%ROWTYPE;
  v_r2_active boolean := false;
  v_r2_started_at timestamptz;
BEGIN
  -- Authenticate admin
  SELECT password_hash INTO pwd_hash FROM public.admin_config LIMIT 1;
  IF pwd_hash IS NULL OR extensions.crypt(admin_pwd, pwd_hash) != pwd_hash THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT is_round2_active, started_at INTO v_r2_active, v_r2_started_at
  FROM public.round2_settings
  WHERE id = 'global_config'
  LIMIT 1;

  SELECT * INTO v_ann FROM public.round2_announcements WHERE id = 'doom_bounty' LIMIT 1;

  SELECT COUNT(*) INTO v_total_players FROM public.participants;
  SELECT COUNT(*) INTO v_formed_teams_count FROM public.round2_teams;
  v_assigned_players_count := v_formed_teams_count * 2;
  v_unassigned_players_count := GREATEST(0, v_total_players - v_assigned_players_count);

  -- Formed teams list with both players details and combined Round 1 scores
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', t.id,
      'team_number', t.team_number,
      'team_name', t.team_name,
      'created_at', t.created_at,
      'player1', json_build_object(
        'id', p1.id,
        'name', p1.name,
        'participant_id', p1.participant_id,
        'round1_score', COALESCE(gs1.score, 0),
        'round1_status', COALESCE(gs1.round_status, 'NOT_STARTED')
      ),
      'player2', json_build_object(
        'id', p2.id,
        'name', p2.name,
        'participant_id', p2.participant_id,
        'round1_score', COALESCE(gs2.score, 0),
        'round1_status', COALESCE(gs2.round_status, 'NOT_STARTED')
      ),
      'combined_round1_score', (COALESCE(gs1.score, 0) + COALESCE(gs2.score, 0))
    ) ORDER BY t.team_number ASC, t.created_at ASC
  ), '[]'::json) INTO v_teams
  FROM public.round2_teams t
  JOIN public.participants p1 ON p1.id = t.player1_id
  LEFT JOIN public.game_sessions gs1 ON gs1.participant_id = p1.id
  JOIN public.participants p2 ON p2.id = t.player2_id
  LEFT JOIN public.game_sessions gs2 ON gs2.participant_id = p2.id;

  -- Unassigned participants pool
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', p.id,
      'name', p.name,
      'participant_id', p.participant_id,
      'round1_score', COALESCE(gs.score, 0),
      'round1_status', COALESCE(gs.round_status, 'NOT_STARTED')
    ) ORDER BY COALESCE(gs.score, 0) DESC, p.name ASC
  ), '[]'::json) INTO v_unassigned
  FROM public.participants p
  LEFT JOIN public.game_sessions gs ON gs.participant_id = p.id
  WHERE p.id NOT IN (
    SELECT player1_id FROM public.round2_teams
    UNION
    SELECT player2_id FROM public.round2_teams
  );

  RETURN json_build_object(
    'is_round2_active', COALESCE(v_r2_active, false),
    'round2_started_at', v_r2_started_at,
    'teams', v_teams,
    'unassigned_players', v_unassigned,
    'stats', json_build_object(
      'total_players', v_total_players,
      'formed_teams_count', v_formed_teams_count,
      'assigned_players_count', v_assigned_players_count,
      'unassigned_players_count', v_unassigned_players_count
    ),
    'broadcast_revealed', COALESCE(v_ann.is_revealed, false),
    'broadcast_message', COALESCE(v_ann.message, '')
  );
END;
$$;

-- 5. Update get_player_team_info: Players ONLY see team details when Round 2 is active!
CREATE OR REPLACE FUNCTION public.get_player_team_info(p_session_token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_participant public.participants%ROWTYPE;
  v_team public.round2_teams%ROWTYPE;
  v_p1 public.participants%ROWTYPE;
  v_p2 public.participants%ROWTYPE;
  v_gs1 public.game_sessions%ROWTYPE;
  v_gs2 public.game_sessions%ROWTYPE;
  v_is_player1 boolean;
  v_total_score integer := 0;
  v_ann public.round2_announcements%ROWTYPE;
  v_r2_active boolean := false;
BEGIN
  -- Authenticate participant via session token
  SELECT * INTO v_participant FROM public.participants WHERE session_token = p_session_token;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'invalid_session');
  END IF;

  SELECT is_round2_active INTO v_r2_active
  FROM public.round2_settings
  WHERE id = 'global_config'
  LIMIT 1;
  v_r2_active := COALESCE(v_r2_active, false);

  -- If Round 2 is NOT active, refuse to leak any team or partner details!
  IF NOT v_r2_active THEN
    RETURN json_build_object(
      'is_round2_active', false,
      'is_assigned', false,
      'participant_name', v_participant.name,
      'participant_id', v_participant.participant_id,
      'broadcast_revealed', false,
      'broadcast_message', NULL
    );
  END IF;

  SELECT * INTO v_ann FROM public.round2_announcements WHERE id = 'doom_bounty' LIMIT 1;

  -- Check if participant is assigned to a team
  SELECT * INTO v_team 
  FROM public.round2_teams 
  WHERE player1_id = v_participant.id OR player2_id = v_participant.id 
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'is_round2_active', true,
      'is_assigned', false,
      'participant_name', v_participant.name,
      'participant_id', v_participant.participant_id,
      'broadcast_revealed', COALESCE(v_ann.is_revealed, false),
      'broadcast_message', CASE WHEN COALESCE(v_ann.is_revealed, false) THEN v_ann.message ELSE NULL END
    );
  END IF;

  -- Fetch details of both team members
  SELECT * INTO v_p1 FROM public.participants WHERE id = v_team.player1_id;
  SELECT * INTO v_p2 FROM public.participants WHERE id = v_team.player2_id;

  -- Fetch Round 1 session scores
  SELECT * INTO v_gs1 FROM public.game_sessions WHERE participant_id = v_p1.id;
  SELECT * INTO v_gs2 FROM public.game_sessions WHERE participant_id = v_p2.id;

  v_is_player1 := (v_participant.id = v_p1.id);
  v_total_score := COALESCE(v_gs1.score, 0) + COALESCE(v_gs2.score, 0);

  RETURN json_build_object(
    'is_round2_active', true,
    'is_assigned', true,
    'team_id', v_team.id,
    'team_number', v_team.team_number,
    'team_name', v_team.team_name,
    'created_at', v_team.created_at,
    'total_score', v_total_score,
    'is_player1', v_is_player1,
    'broadcast_revealed', COALESCE(v_ann.is_revealed, false),
    'broadcast_message', CASE WHEN COALESCE(v_ann.is_revealed, false) THEN v_ann.message ELSE NULL END,
    'player1', json_build_object(
      'name', v_p1.name,
      'participant_id', v_p1.participant_id,
      'score', COALESCE(v_gs1.score, 0),
      'is_you', v_is_player1
    ),
    'player2', json_build_object(
      'name', v_p2.name,
      'participant_id', v_p2.participant_id,
      'score', COALESCE(v_gs2.score, 0),
      'is_you', NOT v_is_player1
    ),
    'you', json_build_object(
      'name', v_participant.name,
      'participant_id', v_participant.participant_id,
      'score', CASE WHEN v_is_player1 THEN COALESCE(v_gs1.score, 0) ELSE COALESCE(v_gs2.score, 0) END,
      'role', CASE WHEN v_is_player1 THEN 'PLAYER 1' ELSE 'PLAYER 2' END
    ),
    'teammate', json_build_object(
      'name', CASE WHEN v_is_player1 THEN v_p2.name ELSE v_p1.name END,
      'participant_id', CASE WHEN v_is_player1 THEN v_p2.participant_id ELSE v_p1.participant_id END,
      'score', CASE WHEN v_is_player1 THEN COALESCE(v_gs2.score, 0) ELSE COALESCE(v_gs1.score, 0) END,
      'role', CASE WHEN v_is_player1 THEN 'PLAYER 2' ELSE 'PLAYER 1' END
    )
  );
END;
$$;

-- 6. Update get_game_state: only includes team details if Round 2 is active
CREATE OR REPLACE FUNCTION public.get_game_state(p_session_token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_participant public.participants%ROWTYPE;
  v_session public.game_sessions%ROWTYPE;
  v_domain public.domains%ROWTYPE;
  v_clues json;
  v_guesses json;
  v_elapsed_seconds integer := 0;
  v_team public.round2_teams%ROWTYPE;
  v_p1 public.participants%ROWTYPE;
  v_p2 public.participants%ROWTYPE;
  v_gs1 public.game_sessions%ROWTYPE;
  v_gs2 public.game_sessions%ROWTYPE;
  v_is_player1 boolean;
  v_total_score integer := 0;
  v_team_json json := NULL;
  v_r2_active boolean := false;
BEGIN
  SELECT * INTO v_participant FROM public.participants WHERE session_token = p_session_token;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'invalid_session');
  END IF;

  SELECT * INTO v_session FROM public.game_sessions WHERE participant_id = v_participant.id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'session_not_found');
  END IF;

  -- Auto-expire if 15 minutes passed
  IF v_session.round_status = 'ACTIVE' AND v_session.started_at IS NOT NULL AND EXTRACT(epoch FROM (now() - v_session.started_at)) >= 900 THEN
    UPDATE public.game_sessions
    SET round_status = 'FAILED',
        completed_at = v_session.started_at + interval '15 minutes',
        updated_at = now()
    WHERE id = v_session.id
    RETURNING * INTO v_session;
  END IF;

  -- Unlocked clues only
  IF v_session.current_clue > 0 THEN
    SELECT COALESCE(json_agg(
      json_build_object(
        'clue_number', clue_number,
        'clue_text', clue_text
      ) ORDER BY clue_number
    ), '[]'::json) INTO v_clues
    FROM public.domain_clues
    WHERE domain_id = v_session.assigned_domain_id AND clue_number <= v_session.current_clue;
  ELSE
    v_clues := '[]'::json;
  END IF;

  -- Guess history
  SELECT COALESCE(json_agg(
    json_build_object(
      'submitted_answer', submitted_answer,
      'is_correct', is_correct,
      'clue_number', clue_number,
      'created_at', created_at
    ) ORDER BY created_at DESC
  ), '[]'::json) INTO v_guesses
  FROM public.guess_history
  WHERE game_session_id = v_session.id;

  IF v_session.started_at IS NOT NULL THEN
    v_elapsed_seconds := EXTRACT(epoch FROM (COALESCE(v_session.completed_at, now()) - v_session.started_at))::integer;
  END IF;

  -- Check Round 2 status
  SELECT is_round2_active INTO v_r2_active
  FROM public.round2_settings
  WHERE id = 'global_config'
  LIMIT 1;
  v_r2_active := COALESCE(v_r2_active, false);

  -- Round 2 Team check ONLY IF Round 2 has begun!
  IF v_r2_active THEN
    SELECT * INTO v_team 
    FROM public.round2_teams 
    WHERE player1_id = v_participant.id OR player2_id = v_participant.id 
    LIMIT 1;

    IF FOUND THEN
      SELECT * INTO v_p1 FROM public.participants WHERE id = v_team.player1_id;
      SELECT * INTO v_p2 FROM public.participants WHERE id = v_team.player2_id;
      SELECT * INTO v_gs1 FROM public.game_sessions WHERE participant_id = v_p1.id;
      SELECT * INTO v_gs2 FROM public.game_sessions WHERE participant_id = v_p2.id;
      v_is_player1 := (v_participant.id = v_p1.id);
      v_total_score := COALESCE(v_gs1.score, 0) + COALESCE(v_gs2.score, 0);

      v_team_json := json_build_object(
        'is_round2_active', true,
        'is_assigned', true,
        'team_id', v_team.id,
        'team_number', v_team.team_number,
        'team_name', v_team.team_name,
        'created_at', v_team.created_at,
        'total_score', v_total_score,
        'is_player1', v_is_player1,
        'player1', json_build_object(
          'name', v_p1.name,
          'participant_id', v_p1.participant_id,
          'score', COALESCE(v_gs1.score, 0),
          'is_you', v_is_player1
        ),
        'player2', json_build_object(
          'name', v_p2.name,
          'participant_id', v_p2.participant_id,
          'score', COALESCE(v_gs2.score, 0),
          'is_you', NOT v_is_player1
        ),
        'you', json_build_object(
          'name', v_participant.name,
          'participant_id', v_participant.participant_id,
          'score', CASE WHEN v_is_player1 THEN COALESCE(v_gs1.score, 0) ELSE COALESCE(v_gs2.score, 0) END,
          'role', CASE WHEN v_is_player1 THEN 'PLAYER 1' ELSE 'PLAYER 2' END
        ),
        'teammate', json_build_object(
          'name', CASE WHEN v_is_player1 THEN v_p2.name ELSE v_p1.name END,
          'participant_id', CASE WHEN v_is_player1 THEN v_p2.participant_id ELSE v_p1.participant_id END,
          'score', CASE WHEN v_is_player1 THEN COALESCE(v_gs2.score, 0) ELSE COALESCE(v_gs1.score, 0) END,
          'role', CASE WHEN v_is_player1 THEN 'PLAYER 2' ELSE 'PLAYER 1' END
        )
      );
    ELSE
      v_team_json := json_build_object(
        'is_round2_active', true,
        'is_assigned', false
      );
    END IF;
  ELSE
    v_team_json := json_build_object(
      'is_round2_active', false,
      'is_assigned', false
    );
  END IF;

  IF v_session.round_status IN ('COMPLETED', 'FAILED') THEN
    SELECT * INTO v_domain FROM public.domains WHERE id = v_session.assigned_domain_id;
    RETURN json_build_object(
      'participant_name', v_participant.name,
      'participant_id', v_participant.participant_id,
      'round_status', v_session.round_status,
      'player_status', v_session.player_status,
      'current_clue', v_session.current_clue,
      'wrong_guess_count', v_session.wrong_guess_count,
      'score', v_session.score,
      'time_taken_seconds', v_elapsed_seconds,
      'elapsed_seconds', v_elapsed_seconds,
      'time_remaining_seconds', GREATEST(0, 900 - v_elapsed_seconds),
      'started_at', v_session.started_at,
      'completed_at', v_session.completed_at,
      'assigned_domain_id', v_session.assigned_domain_id,
      'assigned_domain_name', v_domain.name,
      'unlocked_clues', v_clues,
      'guesses', v_guesses,
      'team', v_team_json
    );
  ELSE
    RETURN json_build_object(
      'participant_name', v_participant.name,
      'participant_id', v_participant.participant_id,
      'round_status', v_session.round_status,
      'player_status', v_session.player_status,
      'current_clue', v_session.current_clue,
      'wrong_guess_count', v_session.wrong_guess_count,
      'score', v_session.score,
      'time_taken_seconds', v_elapsed_seconds,
      'elapsed_seconds', v_elapsed_seconds,
      'time_remaining_seconds', GREATEST(0, 900 - v_elapsed_seconds),
      'started_at', v_session.started_at,
      'completed_at', v_session.completed_at,
      'unlocked_clues', v_clues,
      'guesses', v_guesses,
      'team', v_team_json
    );
  END IF;
END;
$$;

-- 7. Update get_round2_broadcast_message: Only reveal if Round 2 is active!
CREATE OR REPLACE FUNCTION public.get_round2_broadcast_message()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_rec public.round2_announcements%ROWTYPE;
  v_r2_active boolean := false;
BEGIN
  SELECT is_round2_active INTO v_r2_active
  FROM public.round2_settings
  WHERE id = 'global_config'
  LIMIT 1;

  IF NOT COALESCE(v_r2_active, false) THEN
    RETURN json_build_object(
      'is_revealed', false,
      'message', NULL
    );
  END IF;

  SELECT * INTO v_rec FROM public.round2_announcements WHERE id = 'doom_bounty' LIMIT 1;
  IF NOT FOUND THEN
    RETURN json_build_object(
      'is_revealed', false,
      'message', NULL
    );
  END IF;

  RETURN json_build_object(
    'is_revealed', v_rec.is_revealed,
    'message', v_rec.message,
    'revealed_at', v_rec.revealed_at
  );
END;
$$;

-- 8. Permissions
GRANT EXECUTE ON FUNCTION public.set_round2_active TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_round2_status TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_round2_teams_data TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_player_team_info TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_game_state TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_round2_broadcast_message TO anon, authenticated;
