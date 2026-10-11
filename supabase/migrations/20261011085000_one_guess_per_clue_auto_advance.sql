-- ==============================================================================
-- NEMESIS ROUND 1: ONE GUESS PER CLUE & AUTOMATIC ADVANCE ON ADMIN UNLOCK
-- Rule:
-- 1. A player gets only ONE chance per clue to guess the domain.
-- 2. If wrong, the screen locks (PENALTY_PENDING).
-- 3. When an admin unlocks the player, the player is automatically sent to the next clue!
-- 4. Maximum total attempts across all 15 clues is 15.
-- ==============================================================================

-- 1. Submit Guess Function with Single-Guess-Per-Clue Enforcement
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

  -- Enforce 1 guess chance per clue:
  IF EXISTS (
    SELECT 1 FROM public.guess_history
    WHERE game_session_id = v_session.id AND clue_number = v_clue
  ) THEN
    RETURN json_build_object('error', 'already_guessed_on_clue', 'clue_number', v_clue);
  END IF;

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

    -- If clue 15 was reached or 15 wrong guesses, final attempt was made
    IF v_clue >= 15 OR v_new_wrong >= 15 THEN
      UPDATE public.game_sessions
      SET wrong_guess_count = v_new_wrong,
          player_status = 'PENALTY_PENDING',
          updated_at = now()
      WHERE id = v_session.id;

      RETURN json_build_object(
        'correct', false,
        'exhausted', true,
        'round_status', v_session.round_status,
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

-- 2. Resolve Penalty Function with Automatic Next-Clue Advancement
CREATE OR REPLACE FUNCTION public.resolve_penalty(admin_pwd text, p_session_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  pwd_hash text;
  v_session public.game_sessions%ROWTYPE;
  v_next_clue integer;
  v_new_round_status text;
BEGIN
  SELECT password_hash INTO pwd_hash FROM public.admin_config LIMIT 1;
  IF pwd_hash IS NULL OR extensions.crypt(admin_pwd, pwd_hash) != pwd_hash THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT * INTO v_session FROM public.game_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'session_not_found');
  END IF;

  IF v_session.player_status != 'PENALTY_PENDING' THEN
    RETURN json_build_object('error', 'no_pending_penalty');
  END IF;

  -- If player already reached clue 15 or 15 wrong guesses, all 15 attempts are exhausted
  IF v_session.current_clue >= 15 OR v_session.wrong_guess_count >= 15 THEN
    v_next_clue := v_session.current_clue;
    v_new_round_status := 'FAILED';

    UPDATE public.game_sessions
    SET player_status = 'NORMAL',
        round_status = 'FAILED',
        completed_at = COALESCE(completed_at, now()),
        updated_at = now()
    WHERE id = p_session_id;
  ELSE
    -- Automatically advance player to the next clue
    v_next_clue := v_session.current_clue + 1;
    v_new_round_status := v_session.round_status;

    UPDATE public.game_sessions
    SET player_status = 'NORMAL',
        current_clue = v_next_clue,
        updated_at = now()
    WHERE id = p_session_id;
  END IF;

  -- Mark pending penalties as RESOLVED
  UPDATE public.penalty_history
  SET status = 'RESOLVED',
      resolved_at = now(),
      resolved_by = 'admin'
  WHERE game_session_id = p_session_id AND status = 'PENDING';

  -- Record audit log
  INSERT INTO public.admin_audit_log (admin_id, game_session_id, action)
  VALUES ('admin', p_session_id, 'RESOLVED_PENALTY_ADVANCED_TO_CLUE_' || v_next_clue::text);

  RETURN json_build_object(
    'success', true,
    'session_id', p_session_id,
    'player_status', 'NORMAL',
    'current_clue', v_next_clue,
    'round_status', v_new_round_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_guess TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_penalty TO anon, authenticated;
