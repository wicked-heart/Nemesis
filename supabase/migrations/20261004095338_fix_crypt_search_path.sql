/*
# Fix crypt function resolution in admin functions

The pgcrypto extension installs `crypt()` and `gen_salt()` in the `extensions` schema.
The SECURITY DEFINER functions set `search_path = public`, which excludes `extensions`,
causing `crypt()` to not be found.

Fix: update all admin functions that use `crypt()` to include `extensions` in search_path.
*/

-- get_leaderboard
CREATE OR REPLACE FUNCTION get_leaderboard(admin_pwd text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

-- get_admin_stats
CREATE OR REPLACE FUNCTION get_admin_stats(admin_pwd text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

-- get_participant_details
CREATE OR REPLACE FUNCTION get_participant_details(admin_pwd text, p_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

GRANT EXECUTE ON FUNCTION get_leaderboard TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_admin_stats TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_participant_details TO anon, authenticated;
