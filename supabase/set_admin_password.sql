-- ====================================================================
-- SET / CHANGE THE ADMIN PASSWORD
-- ====================================================================
-- The admin password is stored ONLY in the database, encrypted with bcrypt (one-way: it cannot be
-- decoded back into the password). It is deliberately NOT written in this file, because this repo is
-- public. The current password stays active until you run this script.
--
-- To change it: replace PUT-THE-NEW-PASSWORD-HERE below (only in the SQL Editor, never commit it),
-- then run this query in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql/new

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DELETE FROM public.admin_config;
INSERT INTO public.admin_config (password_hash)
VALUES (extensions.crypt('PUT-THE-NEW-PASSWORD-HERE', extensions.gen_salt('bf')));
