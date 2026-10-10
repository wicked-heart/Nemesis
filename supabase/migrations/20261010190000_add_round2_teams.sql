-- ====================================================================
-- NEMESIS: ROUND 2 TEAM FORMATION (PAIRS OF 2)
-- ====================================================================

-- 1. Create round2_teams table
CREATE TABLE IF NOT EXISTS public.round2_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_number integer NOT NULL,
  team_name text NOT NULL UNIQUE,
  player1_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  player2_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_different_players CHECK (player1_id <> player2_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_round2_teams_p1 ON public.round2_teams (player1_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_round2_teams_p2 ON public.round2_teams (player2_id);

ALTER TABLE public.round2_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_anon_round2_teams_select" ON public.round2_teams;
CREATE POLICY "deny_anon_round2_teams_select" ON public.round2_teams
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "deny_anon_round2_teams_write" ON public.round2_teams;
CREATE POLICY "deny_anon_round2_teams_write" ON public.round2_teams
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 2. Create round2_announcements table for Broadcast Decrees (e.g. Cheater Bounty)
CREATE TABLE IF NOT EXISTS public.round2_announcements (
  id text PRIMARY KEY DEFAULT 'doom_bounty',
  message text NOT NULL,
  is_revealed boolean NOT NULL DEFAULT false,
  revealed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.round2_announcements (id, message, is_revealed)
VALUES (
  'doom_bounty',
  '### ☠️ CLASSIFIED DIRECTIVE: OPERATION DOOM

**Psst… You weren''t supposed to see this.**

Doom is hunting down players who have an unfair advantage. Your mission, should you choose to accept it, is to identify participants using **paid AI plans** while others rely on free-tier tools.

Targets include Claude Pro, Claude Max, and other premium AI subscriptions that provide access to enhanced capabilities or usage limits.

**Your reward:** 8 points from every confirmed target.

**Your objective:** Find them. Report them. Help Doom restore balance.

*Trust no one. Question everything. Doom is watching.*

**This message is classified. Proceed discreetly.**',
  false
)
ON CONFLICT (id) DO UPDATE
SET message = EXCLUDED.message;

ALTER TABLE public.round2_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_anon_read_announcements" ON public.round2_announcements;
CREATE POLICY "allow_anon_read_announcements" ON public.round2_announcements
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "deny_anon_write_announcements" ON public.round2_announcements;
CREATE POLICY "deny_anon_write_announcements" ON public.round2_announcements
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 3. Function to fetch Round 2 teams and unassigned players for Admin
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
BEGIN
  -- Authenticate admin
  SELECT password_hash INTO pwd_hash FROM public.admin_config LIMIT 1;
  IF pwd_hash IS NULL OR extensions.crypt(admin_pwd, pwd_hash) != pwd_hash THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

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
    'teams', v_teams,
    'unassigned_players', v_unassigned,
    'stats', json_build_object(
      'total_players', v_total_players,
      'formed_teams_count', v_formed_teams_count,
      'assigned_players_count', v_assigned_players_count,
      'unassigned_players_count', v_unassigned_players_count
    ),
    'broadcast_revealed', COALESCE(v_ann.is_revealed, false),
    'broadcast_message', COALESCE(v_ann.message, '### ☠️ CLASSIFIED DIRECTIVE: OPERATION DOOM

**Psst… You weren''t supposed to see this.**

Doom is hunting down players who have an unfair advantage. Your mission, should you choose to accept it, is to identify participants using **paid AI plans** while others rely on free-tier tools.

Targets include Claude Pro, Claude Max, and other premium AI subscriptions that provide access to enhanced capabilities or usage limits.

**Your reward:** 8 points from every confirmed target.

**Your objective:** Find them. Report them. Help Doom restore balance.

*Trust no one. Question everything. Doom is watching.*

**This message is classified. Proceed discreetly.')
  );
END;
$$;

-- 3. Function to create a team manually
CREATE OR REPLACE FUNCTION public.create_round2_team(
  admin_pwd text,
  p_player1_id uuid,
  p_player2_id uuid,
  p_team_name text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  pwd_hash text;
  v_next_num integer;
  v_final_name text;
  v_new_id uuid;
  v_p1_exists boolean;
  v_p2_exists boolean;
BEGIN
  -- Authenticate admin
  SELECT password_hash INTO pwd_hash FROM public.admin_config LIMIT 1;
  IF pwd_hash IS NULL OR extensions.crypt(admin_pwd, pwd_hash) != pwd_hash THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  -- Validation: distinct players
  IF p_player1_id = p_player2_id THEN
    RETURN json_build_object('error', 'cannot_pair_same_player');
  END IF;

  -- Validation: both players exist
  SELECT EXISTS(SELECT 1 FROM public.participants WHERE id = p_player1_id) INTO v_p1_exists;
  SELECT EXISTS(SELECT 1 FROM public.participants WHERE id = p_player2_id) INTO v_p2_exists;
  IF NOT v_p1_exists OR NOT v_p2_exists THEN
    RETURN json_build_object('error', 'participant_not_found');
  END IF;

  -- Validation: neither player is already assigned
  IF EXISTS(
    SELECT 1 FROM public.round2_teams 
    WHERE player1_id IN (p_player1_id, p_player2_id) 
       OR player2_id IN (p_player1_id, p_player2_id)
  ) THEN
    RETURN json_build_object('error', 'one_or_both_players_already_assigned');
  END IF;

  -- Auto-generate team number & name if not provided
  SELECT COALESCE(MAX(team_number), 0) + 1 INTO v_next_num FROM public.round2_teams;

  IF p_team_name IS NULL OR trim(p_team_name) = '' THEN
    v_final_name := 'Team ' || v_next_num;
  ELSE
    v_final_name := trim(p_team_name);
  END IF;

  -- Ensure name uniqueness
  IF EXISTS (SELECT 1 FROM public.round2_teams WHERE lower(team_name) = lower(v_final_name)) THEN
    v_final_name := v_final_name || ' (' || v_next_num || ')';
  END IF;

  INSERT INTO public.round2_teams (team_number, team_name, player1_id, player2_id)
  VALUES (v_next_num, v_final_name, p_player1_id, p_player2_id)
  RETURNING id INTO v_new_id;

  RETURN json_build_object(
    'success', true,
    'team_id', v_new_id,
    'team_name', v_final_name,
    'team_number', v_next_num
  );
END;
$$;

-- 4. Function to disband a team
CREATE OR REPLACE FUNCTION public.disband_round2_team(
  admin_pwd text,
  p_team_id uuid
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

  DELETE FROM public.round2_teams WHERE id = p_team_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'team_not_found');
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

-- 5. Function for players to get their Round 2 team details
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
BEGIN
  -- Authenticate participant via session token
  SELECT * INTO v_participant FROM public.participants WHERE session_token = p_session_token;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'invalid_session');
  END IF;

  SELECT * INTO v_ann FROM public.round2_announcements WHERE id = 'doom_bounty' LIMIT 1;

  -- Check if participant is assigned to a team
  SELECT * INTO v_team 
  FROM public.round2_teams 
  WHERE player1_id = v_participant.id OR player2_id = v_participant.id 
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object(
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

-- 6. Update get_game_state to include Round 2 team details directly
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

  -- Round 2 Team check
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
      'is_assigned', false,
      'participant_name', v_participant.name,
      'participant_id', v_participant.participant_id
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
      'started_at', v_session.started_at,
      'completed_at', v_session.completed_at,
      'time_taken_seconds', v_elapsed_seconds,
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
      'started_at', v_session.started_at,
      'completed_at', v_session.completed_at,
      'time_taken_seconds', v_elapsed_seconds,
      'unlocked_clues', v_clues,
      'guesses', v_guesses,
      'team', v_team_json
    );
  END IF;
END;
$$;

-- 7. Functions to reveal or check Broadcast Decree
CREATE OR REPLACE FUNCTION public.reveal_round2_broadcast_message(
  admin_pwd text,
  p_reveal boolean DEFAULT true,
  p_message text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  pwd_hash text;
  v_message text;
  v_default_message text := '### ☠️ CLASSIFIED DIRECTIVE: OPERATION DOOM

**Psst… You weren''t supposed to see this.**

Doom is hunting down players who have an unfair advantage. Your mission, should you choose to accept it, is to identify participants using **paid AI plans** while others rely on free-tier tools.

Targets include Claude Pro, Claude Max, and other premium AI subscriptions that provide access to enhanced capabilities or usage limits.

**Your reward:** 8 points from every confirmed target.

**Your objective:** Find them. Report them. Help Doom restore balance.

*Trust no one. Question everything. Doom is watching.*

**This message is classified. Proceed discreetly.';
BEGIN
  SELECT password_hash INTO pwd_hash FROM public.admin_config LIMIT 1;
  IF pwd_hash IS NULL OR extensions.crypt(admin_pwd, pwd_hash) != pwd_hash THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  UPDATE public.round2_announcements
  SET is_revealed = p_reveal,
      message = COALESCE(NULLIF(p_message, ''), v_default_message),
      revealed_at = CASE WHEN p_reveal THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = 'doom_bounty'
  RETURNING message INTO v_message;

  IF NOT FOUND THEN
    INSERT INTO public.round2_announcements (id, message, is_revealed, revealed_at)
    VALUES (
      'doom_bounty',
      COALESCE(NULLIF(p_message, ''), v_default_message),
      p_reveal,
      CASE WHEN p_reveal THEN now() ELSE NULL END
    )
    RETURNING message INTO v_message;
  END IF;

  RETURN json_build_object(
    'success', true,
    'is_revealed', p_reveal,
    'message', v_message
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_round2_broadcast_message()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_rec public.round2_announcements%ROWTYPE;
BEGIN
  SELECT * INTO v_rec FROM public.round2_announcements WHERE id = 'doom_bounty' LIMIT 1;
  IF NOT FOUND THEN
    RETURN json_build_object(
      'is_revealed', false,
      'message', '### ☠️ CLASSIFIED DIRECTIVE: OPERATION DOOM

**Psst… You weren''t supposed to see this.**

Doom is hunting down players who have an unfair advantage. Your mission, should you choose to accept it, is to identify participants using **paid AI plans** while others rely on free-tier tools.

Targets include Claude Pro, Claude Max, and other premium AI subscriptions that provide access to enhanced capabilities or usage limits.

**Your reward:** 8 points from every confirmed target.

**Your objective:** Find them. Report them. Help Doom restore balance.

*Trust no one. Question everything. Doom is watching.*

**This message is classified. Proceed discreetly.'
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
GRANT EXECUTE ON FUNCTION public.get_round2_teams_data TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_round2_team TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.disband_round2_team TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_player_team_info TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_game_state TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reveal_round2_broadcast_message TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_round2_broadcast_message TO anon, authenticated;
