-- ====================================================================
-- UPDATE ADMIN PASSWORD TO: cres.nemesis@2k26
-- ====================================================================
-- Run this query in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql/new

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DELETE FROM public.admin_config;
INSERT INTO public.admin_config (password_hash) 
VALUES (extensions.crypt('cres.nemesis@2k26', extensions.gen_salt('bf')));
