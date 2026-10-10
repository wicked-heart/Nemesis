-- ====================================================================
-- UPDATE SECRET BROADCAST DIRECTIVE TO OPERATION DOOM
-- ====================================================================
-- Run this query in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql/new

UPDATE public.round2_announcements
SET message = '### ☠️ CLASSIFIED DIRECTIVE: OPERATION DOOM

**Psst… You weren''t supposed to see this.**

Doom is hunting down players who have an unfair advantage. Your mission, should you choose to accept it, is to identify participants using **paid AI plans** while others rely on free-tier tools.

Targets include Claude Pro, Claude Max, and other premium AI subscriptions that provide access to enhanced capabilities or usage limits.

**Your reward:** 8 points from every confirmed target.

**Your objective:** Find them. Report them. Help Doom restore balance.

*Trust no one. Question everything. Doom is watching.*

**This message is classified. Proceed discreetly.',
    updated_at = now()
WHERE id = 'doom_bounty';
