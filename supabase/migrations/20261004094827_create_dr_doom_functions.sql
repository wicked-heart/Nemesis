/*
# DR. DOOM Flag Hunt — SECURITY DEFINER Functions

Adds all server-side functions for:
- Participant registration & session management
- Question retrieval (WITHOUT flags)
- Flag submission & scoring (server-computed)
- Admin stats, leaderboard, participant details
- Rank lookup

All timer and scoring logic runs server-side via now() timestamps.
Flags are never exposed to the client.
*/

-- register_participant: creates or resumes a participant session
CREATE OR REPLACE FUNCTION register_participant(p_name text, p_participant_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing participants%ROWTYPE;
  new_participant participants%ROWTYPE;
BEGIN
  SELECT * INTO existing FROM participants WHERE participant_id = p_participant_id;
  IF FOUND THEN
    RETURN json_build_object(
      'id', existing.id,
      'session_token', existing.session_token,
      'name', existing.name,
      'participant_id', existing.participant_id,
      'current_question', existing.current_question,
      'total_score', existing.total_score,
      'completed', existing.completed,
      'resumed', true
    );
  END IF;

  INSERT INTO participants (name, participant_id)
  VALUES (p_name, p_participant_id)
  RETURNING * INTO new_participant;

  RETURN json_build_object(
    'id', new_participant.id,
    'session_token', new_participant.session_token,
    'name', new_participant.name,
    'participant_id', new_participant.participant_id,
    'current_question', new_participant.current_question,
    'total_score', new_participant.total_score,
    'completed', new_participant.completed,
    'resumed', false
  );
END;
$$;

-- get_participant_state: returns current state by session token
CREATE OR REPLACE FUNCTION get_participant_state(p_session_token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p participants%ROWTYPE;
BEGIN
  SELECT * INTO p FROM participants WHERE session_token = p_session_token;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'invalid_session');
  END IF;

  RETURN json_build_object(
    'id', p.id,
    'name', p.name,
    'participant_id', p.participant_id,
    'current_question', p.current_question,
    'total_score', p.total_score,
    'completed', p.completed,
    'start_time', p.start_time,
    'completion_time', p.completion_time,
    'total_time_seconds', p.total_time_seconds,
    'question_start_time', p.question_start_time
  );
END;
$$;

-- get_question_data: returns question WITHOUT the flag
CREATE OR REPLACE FUNCTION get_question_data(q_number integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q questions%ROWTYPE;
BEGIN
  SELECT * INTO q FROM questions WHERE number = q_number;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'question_not_found');
  END IF;

  RETURN json_build_object(
    'number', q.number,
    'title', q.title,
    'scenario', q.scenario,
    'base_points', q.base_points
  );
END;
$$;

-- get_attempt_count: returns number of attempts on a question
CREATE OR REPLACE FUNCTION get_attempt_count(p_session_token uuid, q_number integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_id uuid;
  count_val integer;
BEGIN
  SELECT id INTO p_id FROM participants WHERE session_token = p_session_token;
  IF NOT FOUND THEN
    RETURN -1;
  END IF;

  SELECT COUNT(*) INTO count_val FROM attempts
  WHERE participant_id = p_id AND question_number = q_number;
  RETURN count_val;
END;
$$;

-- submit_flag: validates flag, records attempt, computes score server-side
CREATE OR REPLACE FUNCTION submit_flag(p_session_token uuid, q_number integer, p_submitted_flag text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p participants%ROWTYPE;
  q questions%ROWTYPE;
  is_correct_val boolean;
  penalty_val integer;
  existing_score scores%ROWTYPE;
  time_spent_val integer;
  time_bonus_val integer;
  final_points_val integer;
  attempt_count_val integer;
  now_time timestamptz;
  new_total integer;
BEGIN
  now_time := now();
  SELECT * INTO p FROM participants WHERE session_token = p_session_token;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'invalid_session');
  END IF;

  IF p.completed THEN
    RETURN json_build_object('error', 'hunt_completed');
  END IF;

  IF p.current_question != q_number THEN
    RETURN json_build_object('error', 'wrong_question');
  END IF;

  SELECT * INTO q FROM questions WHERE number = q_number;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'question_not_found');
  END IF;

  SELECT * INTO existing_score FROM scores
  WHERE participant_id = p.id AND question_number = q_number;
  IF FOUND THEN
    RETURN json_build_object('error', 'already_completed');
  END IF;

  is_correct_val := (trim(lower(p_submitted_flag)) = trim(lower(q.flag)));

  IF is_correct_val THEN
    time_spent_val := EXTRACT(epoch FROM (now_time - p.question_start_time))::integer;

    IF time_spent_val < 30 THEN
      time_bonus_val := 50;
    ELSIF time_spent_val <= 60 THEN
      time_bonus_val := 30;
    ELSIF time_spent_val <= 120 THEN
      time_bonus_val := 10;
    ELSE
      time_bonus_val := 0;
    END IF;

    SELECT COUNT(*) INTO attempt_count_val FROM attempts
    WHERE participant_id = p.id AND question_number = q_number;

    SELECT COALESCE(SUM(penalty), 0) INTO penalty_val FROM attempts
    WHERE participant_id = p.id AND question_number = q_number;

    final_points_val := GREATEST(q.base_points + time_bonus_val - penalty_val, 0);
    new_total := p.total_score + final_points_val;

    INSERT INTO attempts (participant_id, question_number, submitted_flag, is_correct, penalty, timestamp)
    VALUES (p.id, q_number, p_submitted_flag, true, 0, now_time);

    INSERT INTO scores (participant_id, question_number, base_points, time_bonus, penalties, final_points, attempts_count, question_start_time, completion_time, time_spent_seconds)
    VALUES (p.id, q_number, q.base_points, time_bonus_val, penalty_val, final_points_val, attempt_count_val + 1, p.question_start_time, now_time, time_spent_val);

    UPDATE participants
    SET total_score = new_total,
        current_question = q_number + 1,
        question_start_time = now_time
    WHERE id = p.id;

    IF q_number >= 15 THEN
      UPDATE participants
      SET completed = true,
          completion_time = now_time,
          total_time_seconds = EXTRACT(epoch FROM (now_time - start_time))::integer
      WHERE id = p.id;
    END IF;

    RETURN json_build_object(
      'correct', true,
      'penalty', 0,
      'time_spent', time_spent_val,
      'time_bonus', time_bonus_val,
      'total_penalty', penalty_val,
      'final_points', final_points_val,
      'base_points', q.base_points,
      'new_total_score', new_total,
      'completed', q_number >= 15
    );
  ELSE
    penalty_val := 20;
    new_total := GREATEST(p.total_score - penalty_val, 0);

    INSERT INTO attempts (participant_id, question_number, submitted_flag, is_correct, penalty, timestamp)
    VALUES (p.id, q_number, p_submitted_flag, false, penalty_val, now_time);

    UPDATE participants SET total_score = new_total WHERE id = p.id;

    SELECT COUNT(*) INTO attempt_count_val FROM attempts
    WHERE participant_id = p.id AND question_number = q_number;

    RETURN json_build_object(
      'correct', false,
      'penalty', penalty_val,
      'attempts', attempt_count_val,
      'new_total_score', new_total
    );
  END IF;
END;
$$;

-- get_leaderboard: admin-only leaderboard
CREATE OR REPLACE FUNCTION get_leaderboard(admin_pwd text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pwd_hash text;
BEGIN
  SELECT password_hash INTO pwd_hash FROM admin_config LIMIT 1;
  IF pwd_hash IS NULL OR crypt(admin_pwd, pwd_hash) != pwd_hash THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  RETURN (
    SELECT COALESCE(json_agg(
      json_build_object(
        'id', id,
        'name', name,
        'participant_id', participant_id,
        'total_score', total_score,
        'total_time_seconds', total_time_seconds,
        'completed', completed,
        'completion_time', completion_time,
        'start_time', start_time
      ) ORDER BY total_score DESC, total_time_seconds ASC
    ), '[]'::json)
    FROM participants
  );
END;
$$;

-- get_admin_stats: admin-only dashboard stats
CREATE OR REPLACE FUNCTION get_admin_stats(admin_pwd text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pwd_hash text;
  total_p integer;
  completed_p integer;
  active_p integer;
  highest_score integer;
  fastest_time integer;
BEGIN
  SELECT password_hash INTO pwd_hash FROM admin_config LIMIT 1;
  IF pwd_hash IS NULL OR crypt(admin_pwd, pwd_hash) != pwd_hash THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT COUNT(*) INTO total_p FROM participants;
  SELECT COUNT(*) INTO completed_p FROM participants WHERE completed = true;
  SELECT COUNT(*) INTO active_p FROM participants WHERE completed = false;
  SELECT COALESCE(MAX(total_score), 0) INTO highest_score FROM participants;
  SELECT COALESCE(MIN(total_time_seconds), 0) INTO fastest_time FROM participants WHERE completed = true AND total_time_seconds > 0;

  RETURN json_build_object(
    'total_participants', total_p,
    'completed_participants', completed_p,
    'active_participants', active_p,
    'highest_score', highest_score,
    'fastest_completion_seconds', fastest_time
  );
END;
$$;

-- get_participant_details: admin-only full participant details
CREATE OR REPLACE FUNCTION get_participant_details(admin_pwd text, p_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pwd_hash text;
  p participants%ROWTYPE;
  score_list json;
  attempt_list json;
BEGIN
  SELECT password_hash INTO pwd_hash FROM admin_config LIMIT 1;
  IF pwd_hash IS NULL OR crypt(admin_pwd, pwd_hash) != pwd_hash THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT * INTO p FROM participants WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  SELECT COALESCE(json_agg(
    json_build_object(
      'question_number', question_number,
      'base_points', base_points,
      'time_bonus', time_bonus,
      'penalties', penalties,
      'final_points', final_points,
      'attempts_count', attempts_count,
      'time_spent_seconds', time_spent_seconds,
      'completion_time', completion_time
    ) ORDER BY question_number
  ), '[]'::json) INTO score_list FROM scores WHERE participant_id = p_id;

  SELECT COALESCE(json_agg(
    json_build_object(
      'question_number', question_number,
      'submitted_flag', submitted_flag,
      'is_correct', is_correct,
      'penalty', penalty,
      'timestamp', timestamp
    ) ORDER BY timestamp
  ), '[]'::json) INTO attempt_list FROM attempts WHERE participant_id = p_id;

  RETURN json_build_object(
    'id', p.id,
    'name', p.name,
    'participant_id', p.participant_id,
    'total_score', p.total_score,
    'total_time_seconds', p.total_time_seconds,
    'completed', p.completed,
    'start_time', p.start_time,
    'completion_time', p.completion_time,
    'current_question', p.current_question,
    'scores', score_list,
    'attempts', attempt_list
  );
END;
$$;

-- get_rank: returns participant rank
CREATE OR REPLACE FUNCTION get_rank(p_session_token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p participants%ROWTYPE;
  rank_val integer;
  total_count integer;
BEGIN
  SELECT * INTO p FROM participants WHERE session_token = p_session_token;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'invalid_session');
  END IF;

  SELECT COUNT(*) + 1 INTO rank_val
  FROM participants
  WHERE total_score > p.total_score;

  SELECT COUNT(*) INTO total_count FROM participants;

  RETURN json_build_object(
    'rank', rank_val,
    'total_participants', total_count
  );
END;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION register_participant TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_participant_state TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_question_data TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_attempt_count TO anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_flag TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_leaderboard TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_admin_stats TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_participant_details TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_rank TO anon, authenticated;
