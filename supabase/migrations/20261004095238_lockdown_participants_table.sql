/*
# Lock down participants table direct access

The participants table was previously open to anon SELECT/INSERT/UPDATE.
This allowed any client to read all participants' data (including session tokens)
or modify scores/completion state directly.

Now all participant operations go through SECURITY DEFINER functions:
- register_participant (INSERT)
- get_participant_state (SELECT by token)
- submit_flag (UPDATE score/progress)
- get_rank (SELECT by token)

Direct table access is denied to anon/authenticated.
*/

DROP POLICY IF EXISTS "anon_insert_participants" ON participants;
DROP POLICY IF EXISTS "anon_select_participants" ON participants;
DROP POLICY IF EXISTS "anon_update_participants" ON participants;

-- Deny all direct access — everything goes through SECURITY DEFINER functions
CREATE POLICY "deny_participants_select" ON participants
  FOR SELECT TO anon, authenticated USING (false);

CREATE POLICY "deny_participants_insert" ON participants
  FOR INSERT TO anon, authenticated WITH CHECK (false);

CREATE POLICY "deny_participants_update" ON participants
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "deny_participants_delete" ON participants
  FOR DELETE TO anon, authenticated USING (false);
