-- ====================================================================
-- NEMESIS: ROUND 2 SCORE ADJUSTMENTS & OPERATION DOOM BOUNTY SYSTEM
-- Allows admin to adjust team scores and unassigned solo player scores.
-- Supports 1-click bounty transfer (-8 from violator, +8 to reporter).
-- All scores floored at 0 (non-negative).
-- ====================================================================

-- 1. Add score_adjustment column to round2_teams
ALTER TABLE public.round2_teams 
ADD COLUMN IF NOT EXISTS score_adjustment integer NOT NULL DEFAULT 0;

-- 2. Create admin_score_adjustments audit table
CREATE TABLE IF NOT EXISTS public.admin_score_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id text NOT NULL DEFAULT 'admin',
  target_type text NOT NULL CHECK (target_type IN ('TEAM', 'INDIVIDUAL')),
  team_id uuid REFERENCES public.round2_teams(id) ON DELETE SET NULL,
  participant_id uuid REFERENCES public.participants(id) ON DELETE SET NULL,
  delta_points integer NOT NULL,
  previous_score integer NOT NULL,
  new_score integer NOT NULL,
  transfer_counterpart_id uuid,
  transfer_counterpart_type text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_score_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_anon_read_score_adjustments" ON public.admin_score_adjustments;
CREATE POLICY "deny_anon_read_score_adjustments" ON public.admin_score_adjustments
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "deny_anon_write_score_adjustments" ON public.admin_score_adjustments;
CREATE POLICY "deny_anon_write_score_adjustments" ON public.admin_score_adjustments
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 3. Update get_round2_teams_data (incorporating score_adjustment)
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

  -- Formed teams list with both players details, score_adjustment, and combined Round 1 scores
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', t.id,
      'team_number', t.team_number,
      'team_name', t.team_name,
      'score_adjustment', t.score_adjustment,
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
      'combined_round1_score', GREATEST(0, (COALESCE(gs1.score, 0) + COALESCE(gs2.score, 0) + t.score_adjustment))
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

-- 4. Update get_player_team_info (incorporating score_adjustment)
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
  v_total_score := GREATEST(0, COALESCE(v_gs1.score, 0) + COALESCE(v_gs2.score, 0) + v_team.score_adjustment);

  RETURN json_build_object(
    'is_round2_active', true,
    'is_assigned', true,
    'team_id', v_team.id,
    'team_number', v_team.team_number,
    'team_name', v_team.team_name,
    'created_at', v_team.created_at,
    'total_score', v_total_score,
    'score_adjustment', v_team.score_adjustment,
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

-- 5. Update get_game_state (incorporating score_adjustment and domain reveal)
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
      v_total_score := GREATEST(0, COALESCE(v_gs1.score, 0) + COALESCE(v_gs2.score, 0) + v_team.score_adjustment);

      v_team_json := json_build_object(
        'is_round2_active', true,
        'is_assigned', true,
        'team_id', v_team.id,
        'team_number', v_team.team_number,
        'team_name', v_team.team_name,
        'created_at', v_team.created_at,
        'total_score', v_total_score,
        'score_adjustment', v_team.score_adjustment,
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

-- 6. RPC: admin_adjust_score (Team score OR Unassigned Solo Participant score)
CREATE OR REPLACE FUNCTION public.admin_adjust_score(
  admin_pwd text,
  p_target_type text,      -- 'TEAM' or 'INDIVIDUAL'
  p_target_id uuid,        -- team.id or participant.id
  p_delta integer,         -- +/- points
  p_reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  pwd_hash text;
  v_team public.round2_teams%ROWTYPE;
  v_gs1 public.game_sessions%ROWTYPE;
  v_gs2 public.game_sessions%ROWTYPE;
  v_participant public.participants%ROWTYPE;
  v_session public.game_sessions%ROWTYPE;
  v_prev_total integer;
  v_new_total integer;
  v_new_adj integer;
BEGIN
  -- Authenticate admin
  SELECT password_hash INTO pwd_hash FROM public.admin_config LIMIT 1;
  IF pwd_hash IS NULL OR extensions.crypt(admin_pwd, pwd_hash) != pwd_hash THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  IF p_target_type = 'TEAM' THEN
    SELECT * INTO v_team FROM public.round2_teams WHERE id = p_target_id;
    IF NOT FOUND THEN
      RETURN json_build_object('error', 'team_not_found');
    END IF;

    SELECT * INTO v_gs1 FROM public.game_sessions WHERE participant_id = v_team.player1_id;
    SELECT * INTO v_gs2 FROM public.game_sessions WHERE participant_id = v_team.player2_id;

    v_prev_total := GREATEST(0, COALESCE(v_gs1.score, 0) + COALESCE(v_gs2.score, 0) + v_team.score_adjustment);
    v_new_total := GREATEST(0, v_prev_total + p_delta);
    v_new_adj := v_team.score_adjustment + (v_new_total - v_prev_total);

    UPDATE public.round2_teams
    SET score_adjustment = v_new_adj,
        updated_at = now()
    WHERE id = v_team.id;

    INSERT INTO public.admin_score_adjustments (
      target_type, team_id, delta_points, previous_score, new_score, reason
    ) VALUES (
      'TEAM', v_team.id, (v_new_total - v_prev_total), v_prev_total, v_new_total, p_reason
    );

    RETURN json_build_object(
      'success', true,
      'target_type', 'TEAM',
      'team_id', v_team.id,
      'team_name', v_team.team_name,
      'previous_score', v_prev_total,
      'new_score', v_new_total,
      'delta', (v_new_total - v_prev_total),
      'score_adjustment', v_new_adj
    );

  ELSIF p_target_type = 'INDIVIDUAL' THEN
    -- Check if participant is already assigned to a team
    IF EXISTS (SELECT 1 FROM public.round2_teams WHERE player1_id = p_target_id OR player2_id = p_target_id) THEN
      RETURN json_build_object(
        'error', 'participant_is_in_team',
        'message', 'Participant belongs to a Round 2 Team. Alter team score instead.'
      );
    END IF;

    SELECT * INTO v_participant FROM public.participants WHERE id = p_target_id;
    IF NOT FOUND THEN
      RETURN json_build_object('error', 'participant_not_found');
    END IF;

    SELECT * INTO v_session FROM public.game_sessions WHERE participant_id = v_participant.id;
    IF NOT FOUND THEN
      RETURN json_build_object('error', 'session_not_found');
    END IF;

    v_prev_total := COALESCE(v_session.score, 0);
    v_new_total := GREATEST(0, v_prev_total + p_delta);

    UPDATE public.game_sessions
    SET score = v_new_total,
        updated_at = now()
    WHERE id = v_session.id;

    INSERT INTO public.admin_score_adjustments (
      target_type, participant_id, delta_points, previous_score, new_score, reason
    ) VALUES (
      'INDIVIDUAL', v_participant.id, (v_new_total - v_prev_total), v_prev_total, v_new_total, p_reason
    );

    RETURN json_build_object(
      'success', true,
      'target_type', 'INDIVIDUAL',
      'participant_id', v_participant.id,
      'participant_name', v_participant.name,
      'previous_score', v_prev_total,
      'new_score', v_new_total,
      'delta', (v_new_total - v_prev_total)
    );
  ELSE
    RETURN json_build_object('error', 'invalid_target_type');
  END IF;
END;
$$;

-- 7. RPC: admin_transfer_bounty (-points from Violator, +points to Reporter)
CREATE OR REPLACE FUNCTION public.admin_transfer_bounty(
  admin_pwd text,
  p_violator_type text,   -- 'TEAM' or 'INDIVIDUAL'
  p_violator_id uuid,     -- team.id or participant.id
  p_reporter_type text,   -- 'TEAM' or 'INDIVIDUAL'
  p_reporter_id uuid,     -- team.id or participant.id
  p_points integer DEFAULT 8,
  p_reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  pwd_hash text;
  v_pts integer := ABS(COALESCE(p_points, 8));
  v_v_prev integer;
  v_v_new integer;
  v_r_prev integer;
  v_r_new integer;
  -- Violator vars
  v_v_team public.round2_teams%ROWTYPE;
  v_v_gs1 public.game_sessions%ROWTYPE;
  v_v_gs2 public.game_sessions%ROWTYPE;
  v_v_p public.participants%ROWTYPE;
  v_v_gs public.game_sessions%ROWTYPE;
  -- Reporter vars
  v_r_team public.round2_teams%ROWTYPE;
  v_r_gs1 public.game_sessions%ROWTYPE;
  v_r_gs2 public.game_sessions%ROWTYPE;
  v_r_p public.participants%ROWTYPE;
  v_r_gs public.game_sessions%ROWTYPE;
BEGIN
  -- Authenticate admin
  SELECT password_hash INTO pwd_hash FROM public.admin_config LIMIT 1;
  IF pwd_hash IS NULL OR extensions.crypt(admin_pwd, pwd_hash) != pwd_hash THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  IF p_violator_id = p_reporter_id AND p_violator_type = p_reporter_type THEN
    RETURN json_build_object('error', 'cannot_transfer_to_same_target');
  END IF;

  -- 1. Deduct from Violator
  IF p_violator_type = 'TEAM' THEN
    SELECT * INTO v_v_team FROM public.round2_teams WHERE id = p_violator_id;
    IF NOT FOUND THEN
      RETURN json_build_object('error', 'violator_team_not_found');
    END IF;
    SELECT * INTO v_v_gs1 FROM public.game_sessions WHERE participant_id = v_v_team.player1_id;
    SELECT * INTO v_v_gs2 FROM public.game_sessions WHERE participant_id = v_v_team.player2_id;

    v_v_prev := GREATEST(0, COALESCE(v_v_gs1.score, 0) + COALESCE(v_v_gs2.score, 0) + v_v_team.score_adjustment);
    v_v_new := GREATEST(0, v_v_prev - v_pts);

    UPDATE public.round2_teams
    SET score_adjustment = score_adjustment + (v_v_new - v_v_prev),
        updated_at = now()
    WHERE id = v_v_team.id;

    INSERT INTO public.admin_score_adjustments (
      target_type, team_id, delta_points, previous_score, new_score, 
      transfer_counterpart_id, transfer_counterpart_type, reason
    ) VALUES (
      'TEAM', v_v_team.id, (v_v_new - v_v_prev), v_v_prev, v_v_new,
      p_reporter_id, p_reporter_type, COALESCE(p_reason, 'Operation Doom: Target Penalized')
    );

  ELSIF p_violator_type = 'INDIVIDUAL' THEN
    IF EXISTS (SELECT 1 FROM public.round2_teams WHERE player1_id = p_violator_id OR player2_id = p_violator_id) THEN
      RETURN json_build_object('error', 'violator_in_team', 'message', 'Violator is in a team; select Team target.');
    END IF;
    SELECT * INTO v_v_p FROM public.participants WHERE id = p_violator_id;
    IF NOT FOUND THEN
      RETURN json_build_object('error', 'violator_not_found');
    END IF;
    SELECT * INTO v_v_gs FROM public.game_sessions WHERE participant_id = v_v_p.id;

    v_v_prev := COALESCE(v_v_gs.score, 0);
    v_v_new := GREATEST(0, v_v_prev - v_pts);

    UPDATE public.game_sessions
    SET score = v_v_new,
        updated_at = now()
    WHERE id = v_v_gs.id;

    INSERT INTO public.admin_score_adjustments (
      target_type, participant_id, delta_points, previous_score, new_score,
      transfer_counterpart_id, transfer_counterpart_type, reason
    ) VALUES (
      'INDIVIDUAL', v_v_p.id, (v_v_new - v_v_prev), v_v_prev, v_v_new,
      p_reporter_id, p_reporter_type, COALESCE(p_reason, 'Operation Doom: Target Penalized')
    );
  ELSE
    RETURN json_build_object('error', 'invalid_violator_type');
  END IF;

  -- 2. Award to Reporter
  IF p_reporter_type = 'TEAM' THEN
    SELECT * INTO v_r_team FROM public.round2_teams WHERE id = p_reporter_id;
    IF NOT FOUND THEN
      RETURN json_build_object('error', 'reporter_team_not_found');
    END IF;
    SELECT * INTO v_r_gs1 FROM public.game_sessions WHERE participant_id = v_r_team.player1_id;
    SELECT * INTO v_r_gs2 FROM public.game_sessions WHERE participant_id = v_r_team.player2_id;

    v_r_prev := GREATEST(0, COALESCE(v_r_gs1.score, 0) + COALESCE(v_r_gs2.score, 0) + v_r_team.score_adjustment);
    v_r_new := v_r_prev + v_pts;

    UPDATE public.round2_teams
    SET score_adjustment = score_adjustment + v_pts,
        updated_at = now()
    WHERE id = v_r_team.id;

    INSERT INTO public.admin_score_adjustments (
      target_type, team_id, delta_points, previous_score, new_score,
      transfer_counterpart_id, transfer_counterpart_type, reason
    ) VALUES (
      'TEAM', v_r_team.id, v_pts, v_r_prev, v_r_new,
      p_violator_id, p_violator_type, COALESCE(p_reason, 'Operation Doom: Bounty Claimed')
    );

  ELSIF p_reporter_type = 'INDIVIDUAL' THEN
    IF EXISTS (SELECT 1 FROM public.round2_teams WHERE player1_id = p_reporter_id OR player2_id = p_reporter_id) THEN
      RETURN json_build_object('error', 'reporter_in_team', 'message', 'Reporter is in a team; select Team target.');
    END IF;
    SELECT * INTO v_r_p FROM public.participants WHERE id = p_reporter_id;
    IF NOT FOUND THEN
      RETURN json_build_object('error', 'reporter_not_found');
    END IF;
    SELECT * INTO v_r_gs FROM public.game_sessions WHERE participant_id = v_r_p.id;

    v_r_prev := COALESCE(v_r_gs.score, 0);
    v_r_new := v_r_prev + v_pts;

    UPDATE public.game_sessions
    SET score = v_r_new,
        updated_at = now()
    WHERE id = v_r_gs.id;

    INSERT INTO public.admin_score_adjustments (
      target_type, participant_id, delta_points, previous_score, new_score,
      transfer_counterpart_id, transfer_counterpart_type, reason
    ) VALUES (
      'INDIVIDUAL', v_r_p.id, v_pts, v_r_prev, v_r_new,
      p_violator_id, p_violator_type, COALESCE(p_reason, 'Operation Doom: Bounty Claimed')
    );
  ELSE
    RETURN json_build_object('error', 'invalid_reporter_type');
  END IF;

  RETURN json_build_object(
    'success', true,
    'points_transferred', v_pts,
    'violator', json_build_object(
      'type', p_violator_type,
      'id', p_violator_id,
      'previous_score', v_v_prev,
      'new_score', v_v_new,
      'deducted', (v_v_prev - v_v_new)
    ),
    'reporter', json_build_object(
      'type', p_reporter_type,
      'id', p_reporter_id,
      'previous_score', v_r_prev,
      'new_score', v_r_new,
      'awarded', v_pts
    )
  );
END;
$$;

-- 8. Permissions
GRANT EXECUTE ON FUNCTION public.admin_adjust_score TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_transfer_bounty TO anon, authenticated;
