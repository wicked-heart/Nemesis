/*
# DR. DOOM Flag Hunt — Tables & RLS

Creates all base tables with RLS policies. Functions added in a follow-up migration.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============ PARTICIPANTS ============
CREATE TABLE IF NOT EXISTS participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  participant_id text NOT NULL,
  session_token uuid NOT NULL DEFAULT gen_random_uuid(),
  start_time timestamptz NOT NULL DEFAULT now(),
  completion_time timestamptz,
  total_score integer NOT NULL DEFAULT 0,
  total_time_seconds integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  current_question integer NOT NULL DEFAULT 1,
  question_start_time timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(participant_id)
);

ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_participants" ON participants;
CREATE POLICY "anon_insert_participants" ON participants
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_participants" ON participants;
CREATE POLICY "anon_select_participants" ON participants
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_update_participants" ON participants;
CREATE POLICY "anon_update_participants" ON participants
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ============ QUESTIONS ============
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number integer NOT NULL UNIQUE,
  title text NOT NULL,
  scenario text NOT NULL,
  base_points integer NOT NULL,
  flag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- Direct SELECT denied to prevent flag leakage; reads go through SECURITY DEFINER function
DROP POLICY IF EXISTS "deny_anon_questions" ON questions;
CREATE POLICY "deny_anon_questions" ON questions
  FOR SELECT TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "deny_anon_insert_questions" ON questions;
CREATE POLICY "deny_anon_insert_questions" ON questions
  FOR INSERT TO anon, authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "deny_anon_update_questions" ON questions;
CREATE POLICY "deny_anon_update_questions" ON questions
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

-- ============ ATTEMPTS ============
CREATE TABLE IF NOT EXISTS attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  question_number integer NOT NULL,
  submitted_flag text NOT NULL,
  is_correct boolean NOT NULL,
  penalty integer NOT NULL DEFAULT 0,
  timestamp timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_anon_attempts_select" ON attempts;
CREATE POLICY "deny_anon_attempts_select" ON attempts
  FOR SELECT TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "deny_anon_attempts_insert" ON attempts;
CREATE POLICY "deny_anon_attempts_insert" ON attempts
  FOR INSERT TO anon, authenticated WITH CHECK (false);

-- ============ SCORES ============
CREATE TABLE IF NOT EXISTS scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  question_number integer NOT NULL,
  base_points integer NOT NULL DEFAULT 0,
  time_bonus integer NOT NULL DEFAULT 0,
  penalties integer NOT NULL DEFAULT 0,
  final_points integer NOT NULL DEFAULT 0,
  attempts_count integer NOT NULL DEFAULT 0,
  question_start_time timestamptz NOT NULL,
  completion_time timestamptz NOT NULL DEFAULT now(),
  time_spent_seconds integer NOT NULL DEFAULT 0,
  UNIQUE(participant_id, question_number)
);

ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_anon_scores_select" ON scores;
CREATE POLICY "deny_anon_scores_select" ON scores
  FOR SELECT TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "deny_anon_scores_insert" ON scores;
CREATE POLICY "deny_anon_scores_insert" ON scores
  FOR INSERT TO anon, authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "deny_anon_scores_update" ON scores;
CREATE POLICY "deny_anon_scores_update" ON scores
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

-- ============ ADMIN CONFIG ============
CREATE TABLE IF NOT EXISTS admin_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_anon_admin" ON admin_config;
CREATE POLICY "deny_anon_admin" ON admin_config
  FOR SELECT TO anon, authenticated USING (false);

-- Set default admin password
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_config) THEN
    INSERT INTO admin_config (password_hash) VALUES (crypt('drdoom_admin_2026', gen_salt('bf')));
  END IF;
END $$;

-- ============ SEED QUESTIONS ============
INSERT INTO questions (number, title, scenario, base_points, flag) VALUES
(1, 'THE FEATURE THAT NEVER EXISTED', 'A machine-failure prediction model uses: temperature, pressure, vibration, maintenance_age, and failure_confirmed_by_engineer. The problem is that failure_confirmed_by_engineer only exists AFTER the machine has already failed. Identify the concept.', 100, 'FLAG{FUTURE_IN_THE_PAST}'),
(2, 'THE PERFECTLY UNFAIR MODEL', 'A fraud detector reports 98.7% accuracy. However, 99% of all transactions are legitimate and the model predicts legitimate for almost everyone while missing many fraudulent transactions. Identify the concept.', 100, 'FLAG{MAJORITY_IS_NOT_TRUTH}'),
(3, 'THE MODEL THAT REMEMBERS YOUR NAME', 'A neural network achieves: Training accuracy: 99.8%, Validation accuracy: 71%. Small modifications to the training data cause large changes in predictions. Identify the concept.', 100, 'FLAG{MEMORY_IS_NOT_LEARNING}'),
(4, 'THE TWO MODELS', 'Medical screening — Model A: Precision = 0.96, Recall = 0.42. Model B: Precision = 0.78, Recall = 91%. The hospital says missing a real patient is much worse than sending someone for additional testing. Identify the decision principle.', 100, 'FLAG{MISS_COSTS_MORE}'),
(5, 'THE FOUR BOXES', 'An intrusion detection system can: correctly detect an attack, miss an attack, correctly accept normal traffic, incorrectly flag normal traffic as an attack. Identify the concept.', 100, 'FLAG{FOUR_WAYS_TO_BE_RIGHT_OR_WRONG}'),
(6, 'THE NUMBER THAT LIES BETWEEN VARIABLES', 'Ice cream sales and drowning incidents increase together. A junior claims ice cream causes drowning. A senior says another variable may influence both. Identify the concept.', 150, 'FLAG{TOGETHER_NOT_CAUSE}'),
(7, 'THE DIMENSIONS THAT DISAPPEAR', 'A dataset has 500 numerical dimensions. We transform the coordinate system so that the first new direction captures maximum variance, the next captures the next largest independent direction, and the data can be compressed without simply deleting original variables. Identify the technique.', 150, 'FLAG{ROTATE_BEFORE_COMPRESS}'),
(8, 'THE CROWD WITHOUT LABELS', '10,000 customers have no predefined categories. The algorithm must discover natural groups within the customers. Identify the concept.', 150, 'FLAG{STRUCTURE_WITHOUT_TEACHER}'),
(9, 'THE GRADIENT THAT DIED', 'In a deep neural network, the backpropagated signal becomes smaller and smaller as it moves toward earlier layers. The early layers barely learn. Identify the problem.', 150, 'FLAG{SIGNAL_DIES_BACKWARD}'),
(10, 'THE MODEL WITH TWO PERSONALITIES', 'Model X is simple and stable but makes systematic mistakes. Model Y is highly sensitive to small changes in training data and fits noise. Identify the concept.', 150, 'FLAG{SIMPLICITY_VS_SENSITIVITY}'),
(11, 'THE PROBABILITY THAT CHANGED', 'A rare disease has a 1% prior probability. A patient tests positive. A student immediately says there is a 99% chance the patient has the disease. A statistician says the probability before the evidence still matters. Identify the concept.', 200, 'FLAG{THE_PRIOR_STILL_MATTERS}'),
(12, 'THE DATA THAT KNEW TOO MUCH', 'A demand forecasting model receives an unusually high validation score because normalization statistics were calculated using the entire dataset, including the future validation period. Identify the concept.', 200, 'FLAG{THE_FUTURE_LEAKED_BACK}'),
(13, 'THE WORLD CHANGED', 'A model trained using 2023 data performs well. By 2026: user behavior changed, devices changed, economic conditions changed, preferences changed. The model''s performance collapses. Identify the concept.', 200, 'FLAG{THE_DISTRIBUTION_MOVED}'),
(14, 'THE METRIC TRAP', 'Model A: Accuracy = 95%, Precision = 60%, Recall = 99%. Model B: Accuracy = 93%, Precision = 91%, Recall = 88%. A manager chooses Model A only because its accuracy is higher. The scientist asks what the actual application cares about. Identify the concept.', 200, 'FLAG{THE_METRIC_NEEDS_A_MISSION}'),
(15, 'DR. DOOM''S FINAL TRAP', 'Model A: Training = 99.9%, Validation = 72%, Test = 70%. Model B: Training = 91%, Validation = 89%, Test = 90%. A careless scientist chooses Model A. The senior scientist asks: "Which model learned something that survives outside the training data?" Identify the concept.', 300, 'FLAG{GENERALIZATION_BEATS_MEMORY}')
ON CONFLICT (number) DO NOTHING;
