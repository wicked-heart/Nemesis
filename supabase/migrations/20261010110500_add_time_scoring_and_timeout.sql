-- ====================================================================
-- NEMESIS ROUND 1: TIME-EFFICIENCY MULTIPLIER, 15-MIN TIMEOUT & LEADERBOARD TIE-BREAKER
-- ====================================================================

-- 1. reveal_next_clue with 15-minute countdown auto-expiration
CREATE OR REPLACE FUNCTION public.reveal_next_clue(p_session_token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_participant public.participants%ROWTYPE;
  v_session public.game_sessions%ROWTYPE;
  v_next_clue integer;
  v_clue_text text;
BEGIN
  SELECT * INTO v_participant FROM public.participants WHERE session_token = p_session_token;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'invalid_session');
  END IF;

  SELECT * INTO v_session FROM public.game_sessions WHERE participant_id = v_participant.id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'session_not_found');
  END IF;

  -- 15-minute expiration check
  IF v_session.started_at IS NOT NULL AND EXTRACT(epoch FROM (now() - v_session.started_at)) >= 900 THEN
    UPDATE public.game_sessions
    SET round_status = 'FAILED',
        completed_at = v_session.started_at + interval '15 minutes',
        updated_at = now()
    WHERE id = v_session.id;

    RETURN json_build_object('error', 'round_timed_out', 'timed_out', true);
  END IF;

  IF v_session.round_status != 'ACTIVE' THEN
    RETURN json_build_object('error', 'round_not_active');
  END IF;

  -- Server-side lock enforcement: blocked while LOCKED / PENALTY_PENDING
  IF v_session.player_status = 'PENALTY_PENDING' THEN
    RETURN json_build_object('error', 'player_locked', 'player_status', 'PENALTY_PENDING');
  END IF;

  IF v_session.current_clue >= 15 THEN
    RETURN json_build_object('error', 'maximum_clues_reached');
  END IF;

  v_next_clue := v_session.current_clue + 1;

  UPDATE public.game_sessions
  SET current_clue = v_next_clue,
      updated_at = now()
  WHERE id = v_session.id;

  SELECT clue_text INTO v_clue_text
  FROM public.domain_clues
  WHERE domain_id = v_session.assigned_domain_id AND clue_number = v_next_clue;

  RETURN json_build_object(
    'current_clue', v_next_clue,
    'clue_text', v_clue_text
  );
END;
$$;

-- 2. submit_guess with Time Multipliers & 15-min countdown
CREATE OR REPLACE FUNCTION public.submit_guess(p_session_token uuid, p_guess text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_participant public.participants%ROWTYPE;
  v_session public.game_sessions%ROWTYPE;
  v_domain public.domains%ROWTYPE;
  v_is_correct boolean;
  v_base_score integer := 0;
  v_score integer := 0;
  v_new_wrong integer;
  v_clue integer;
  v_elapsed_seconds integer := 0;
  v_speed_tier text := 'STANDARD';
  v_multiplier numeric := 1.0;
BEGIN
  SELECT * INTO v_participant FROM public.participants WHERE session_token = p_session_token;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'invalid_session');
  END IF;

  SELECT * INTO v_session FROM public.game_sessions WHERE participant_id = v_participant.id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'session_not_found');
  END IF;

  SELECT * INTO v_domain FROM public.domains WHERE id = v_session.assigned_domain_id;

  -- 15-Minute Countdown Check (900 seconds)
  IF v_session.started_at IS NOT NULL THEN
    v_elapsed_seconds := EXTRACT(epoch FROM (now() - v_session.started_at))::integer;
    IF v_elapsed_seconds >= 900 THEN
      UPDATE public.game_sessions
      SET round_status = 'FAILED',
          completed_at = v_session.started_at + interval '15 minutes',
          updated_at = now()
      WHERE id = v_session.id;

      RETURN json_build_object(
        'error', 'round_timed_out',
        'timed_out', true,
        'exhausted', true,
        'round_status', 'FAILED',
        'player_status', v_session.player_status,
        'wrong_guess_count', v_session.wrong_guess_count,
        'domain_name', v_domain.name
      );
    END IF;
  END IF;

  IF v_session.round_status != 'ACTIVE' THEN
    RETURN json_build_object('error', 'round_not_active');
  END IF;

  -- Server-side lock enforcement: blocked while LOCKED / PENALTY_PENDING
  IF v_session.player_status = 'PENALTY_PENDING' THEN
    RETURN json_build_object('error', 'player_locked', 'player_status', 'PENALTY_PENDING');
  END IF;

  v_clue := v_session.current_clue;

  -- Validate guess against domain
  v_is_correct := public.check_domain_match(p_guess, v_domain.slug);

  -- Record guess in history
  INSERT INTO public.guess_history (game_session_id, submitted_answer, is_correct, clue_number)
  VALUES (v_session.id, p_guess, v_is_correct, v_clue);

  IF v_is_correct THEN
    -- Base scoring rules by clue tier:
    -- Clues 1-4: 15 pts
    -- Clues 5-7: 12 pts
    -- Clues 8-10: 9 pts
    -- Clues 11-13: 6 pts
    -- Clues 14-15: 3 pts
    IF v_clue <= 4 THEN
      v_base_score := 15;
    ELSIF v_clue <= 7 THEN
      v_base_score := 12;
    ELSIF v_clue <= 10 THEN
      v_base_score := 9;
    ELSIF v_clue <= 13 THEN
      v_base_score := 6;
    ELSE
      v_base_score := 3;
    END IF;

    -- Time Efficiency Multiplier:
    -- Under 2 mins (< 120s): 1.30x (Rapid Lightning Solve)
    -- 2 - 5 mins (120s - 300s): 1.15x (Swift Solve)
    -- 5 - 10 mins (300s - 600s): 1.00x (Standard)
    -- 10 - 15 mins (600s - 900s): 0.90x (Overtime)
    IF v_elapsed_seconds < 120 THEN
      v_multiplier := 1.30;
      v_speed_tier := 'LIGHTNING';
    ELSIF v_elapsed_seconds < 300 THEN
      v_multiplier := 1.15;
      v_speed_tier := 'SWIFT';
    ELSIF v_elapsed_seconds < 600 THEN
      v_multiplier := 1.00;
      v_speed_tier := 'STANDARD';
    ELSE
      v_multiplier := 0.90;
      v_speed_tier := 'OVERTIME';
    END IF;

    v_score := round(v_base_score * v_multiplier);

    UPDATE public.game_sessions
    SET round_status = 'COMPLETED',
        score = v_score,
        completed_at = now(),
        updated_at = now()
    WHERE id = v_session.id;

    RETURN json_build_object(
      'correct', true,
      'score', v_score,
      'base_score', v_base_score,
      'time_multiplier', v_multiplier,
      'speed_tier', v_speed_tier,
      'time_taken_seconds', v_elapsed_seconds,
      'domain_name', v_domain.name,
      'round_status', 'COMPLETED',
      'current_clue', v_clue,
      'wrong_guess_count', v_session.wrong_guess_count,
      'player_status', v_session.player_status
    );
  ELSE
    v_new_wrong := v_session.wrong_guess_count + 1;

    -- Record penalty incident
    INSERT INTO public.penalty_history (game_session_id, penalty_type, status)
    VALUES (v_session.id, 'WRONG_GUESS', 'PENDING');

    -- If clue 15 was reached, final guess was exhausted
    IF v_clue >= 15 THEN
      UPDATE public.game_sessions
      SET wrong_guess_count = v_new_wrong,
          player_status = 'PENALTY_PENDING',
          round_status = 'FAILED',
          completed_at = now(),
          updated_at = now()
      WHERE id = v_session.id;

      RETURN json_build_object(
        'correct', false,
        'exhausted', true,
        'round_status', 'FAILED',
        'player_status', 'PENALTY_PENDING',
        'wrong_guess_count', v_new_wrong,
        'domain_name', v_domain.name
      );
    ELSE
      UPDATE public.game_sessions
      SET wrong_guess_count = v_new_wrong,
          player_status = 'PENALTY_PENDING',
          updated_at = now()
      WHERE id = v_session.id;

      RETURN json_build_object(
        'correct', false,
        'exhausted', false,
        'round_status', 'ACTIVE',
        'player_status', 'PENALTY_PENDING',
        'wrong_guess_count', v_new_wrong
      );
    END IF;
  END IF;
END;
$$;

-- 3. get_game_state with auto-expiration
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

  -- Unlocked clues only (clue_number <= current_clue)
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

  -- Guess history for this session
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

  -- Only reveal domain if round is completed or failed
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
      'guesses', v_guesses
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
      'guesses', v_guesses
    );
  END IF;
END;
$$;

-- 4. timeout_round (Manual or Frontend-Triggered Countdown Expiration)
CREATE OR REPLACE FUNCTION public.timeout_round(p_session_token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_participant public.participants%ROWTYPE;
  v_session public.game_sessions%ROWTYPE;
  v_domain public.domains%ROWTYPE;
BEGIN
  SELECT * INTO v_participant FROM public.participants WHERE session_token = p_session_token;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'invalid_session');
  END IF;

  SELECT * INTO v_session FROM public.game_sessions WHERE participant_id = v_participant.id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'session_not_found');
  END IF;

  SELECT * INTO v_domain FROM public.domains WHERE id = v_session.assigned_domain_id;

  IF v_session.round_status = 'ACTIVE' THEN
    UPDATE public.game_sessions
    SET round_status = 'FAILED',
        completed_at = COALESCE(v_session.started_at + interval '15 minutes', now()),
        updated_at = now()
    WHERE id = v_session.id
    RETURNING * INTO v_session;
  END IF;

  RETURN json_build_object(
    'timed_out', true,
    'round_status', v_session.round_status,
    'domain_name', v_domain.name
  );
END;
$$;

-- 5. get_admin_dashboard with Time Taken & Leaderboard Tie-Breaker
CREATE OR REPLACE FUNCTION public.get_admin_dashboard(admin_pwd text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  pwd_hash text;
  v_participants json;
  v_total_players integer;
  v_active_players integer;
  v_completed_players integer;
  v_failed_players integer;
  v_penalty_pending_count integer;
BEGIN
  SELECT password_hash INTO pwd_hash FROM public.admin_config LIMIT 1;
  IF pwd_hash IS NULL OR extensions.crypt(admin_pwd, pwd_hash) != pwd_hash THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT COUNT(*) INTO v_total_players FROM public.game_sessions;
  SELECT COUNT(*) INTO v_active_players FROM public.game_sessions WHERE round_status = 'ACTIVE';
  SELECT COUNT(*) INTO v_completed_players FROM public.game_sessions WHERE round_status = 'COMPLETED';
  SELECT COUNT(*) INTO v_failed_players FROM public.game_sessions WHERE round_status = 'FAILED';
  SELECT COUNT(*) INTO v_penalty_pending_count FROM public.game_sessions WHERE player_status = 'PENALTY_PENDING';

  SELECT COALESCE(json_agg(
    json_build_object(
      'session_id', gs.id,
      'participant_name', p.name,
      'participant_id', p.participant_id,
      'assigned_domain_name', d.name,
      'round_status', gs.round_status,
      'player_status', gs.player_status,
      'current_clue', gs.current_clue,
      'wrong_guess_count', gs.wrong_guess_count,
      'score', gs.score,
      'started_at', gs.started_at,
      'completed_at', gs.completed_at,
      'time_taken_seconds', CASE 
        WHEN gs.completed_at IS NOT NULL AND gs.started_at IS NOT NULL THEN 
          EXTRACT(epoch FROM (gs.completed_at - gs.started_at))::integer 
        ELSE NULL 
      END
    ) ORDER BY gs.score DESC, 
      (CASE WHEN gs.completed_at IS NOT NULL AND gs.started_at IS NOT NULL THEN EXTRACT(epoch FROM (gs.completed_at - gs.started_at)) ELSE 999999 END) ASC, 
      gs.wrong_guess_count ASC, 
      gs.created_at ASC
  ), '[]'::json) INTO v_participants
  FROM public.game_sessions gs
  JOIN public.participants p ON p.id = gs.participant_id
  JOIN public.domains d ON d.id = gs.assigned_domain_id;

  RETURN json_build_object(
    'stats', json_build_object(
      'total_players', v_total_players,
      'active_players', v_active_players,
      'completed_players', v_completed_players,
      'failed_players', v_failed_players,
      'penalty_pending_count', v_penalty_pending_count
    ),
    'participants', v_participants
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reveal_next_clue TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_guess TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_game_state TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.timeout_round TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard TO anon, authenticated;

