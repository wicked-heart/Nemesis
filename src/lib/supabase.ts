import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://dlmomjvwnfivloqxkhip.supabase.co';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsbW9tanZ3bmZpdmxvcXhraGlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1Nzc1OTAsImV4cCI6MjEwNzE1MzU5MH0.D5Ql2TBhj14OQvENn_a48DbG3mpZ3EnaIEzuNRTocOk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});
