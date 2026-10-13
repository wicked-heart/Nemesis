-- ====================================================================
-- NEMESIS — ROUND 1: FIND THE FLAG
-- COMPLETE DATABASE SCHEMA, SEEDS & SECURE FUNCTIONS
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ====================================================================
-- 1. BASE TABLES
-- ====================================================================

-- PARTICIPANTS TABLE
CREATE TABLE IF NOT EXISTS public.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  participant_id text NOT NULL,
  session_token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(participant_id)
);

-- DOMAINS TABLE
CREATE TABLE IF NOT EXISTS public.domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- DOMAIN CLUES TABLE (15 ordered clues per domain)
CREATE TABLE IF NOT EXISTS public.domain_clues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  clue_number integer NOT NULL CHECK (clue_number BETWEEN 1 AND 15),
  clue_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(domain_id, clue_number)
);

-- GAME SESSIONS TABLE (One persistent Round 1 session per participant)
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  assigned_domain_id uuid NOT NULL REFERENCES public.domains(id),
  round_status text NOT NULL CHECK (round_status IN ('NOT_STARTED', 'ACTIVE', 'COMPLETED', 'FAILED')) DEFAULT 'NOT_STARTED',
  player_status text NOT NULL CHECK (player_status IN ('NORMAL', 'PENALTY_PENDING')) DEFAULT 'NORMAL',
  current_clue integer NOT NULL DEFAULT 0 CHECK (current_clue BETWEEN 0 AND 15),
  wrong_guess_count integer NOT NULL DEFAULT 0,
  score integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(participant_id)
);

-- GUESS HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.guess_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  submitted_answer text NOT NULL,
  is_correct boolean NOT NULL,
  clue_number integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- PENALTY HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.penalty_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  penalty_type text NOT NULL DEFAULT 'WRONG_GUESS',
  status text NOT NULL CHECK (status IN ('PENDING', 'RESOLVED')) DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by text
);

-- ADMIN AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id text NOT NULL,
  game_session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ADMIN CONFIG TABLE (Credentials)
CREATE TABLE IF NOT EXISTS public.admin_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ====================================================================
-- 2. ROW LEVEL SECURITY (RLS) POLICIES — ZERO DIRECT CLIENT ACCESS
-- ====================================================================

ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_clues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guess_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penalty_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;

-- Block direct anonymous and authenticated access to all tables.
-- All operations run strictly through SECURITY DEFINER RPC functions.
DROP POLICY IF EXISTS "deny_participants_access" ON public.participants;
CREATE POLICY "deny_participants_access" ON public.participants FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "deny_domains_access" ON public.domains;
CREATE POLICY "deny_domains_access" ON public.domains FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "deny_domain_clues_access" ON public.domain_clues;
CREATE POLICY "deny_domain_clues_access" ON public.domain_clues FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "deny_game_sessions_access" ON public.game_sessions;
CREATE POLICY "deny_game_sessions_access" ON public.game_sessions FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "deny_guess_history_access" ON public.guess_history;
CREATE POLICY "deny_guess_history_access" ON public.guess_history FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "deny_penalty_history_access" ON public.penalty_history;
CREATE POLICY "deny_penalty_history_access" ON public.penalty_history FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "deny_admin_audit_log_access" ON public.admin_audit_log;
CREATE POLICY "deny_admin_audit_log_access" ON public.admin_audit_log FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "deny_admin_config_access" ON public.admin_config;
CREATE POLICY "deny_admin_config_access" ON public.admin_config FOR ALL TO anon, authenticated USING (false);

-- ====================================================================
-- 3. SEED ADMIN CONFIG
-- ====================================================================

-- Admin password: stored only in the database, encrypted with bcrypt (one-way). It is not written
-- here because this repo is public. Set or change it with supabase/set_admin_password.sql.
DELETE FROM public.admin_config;
INSERT INTO public.admin_config (password_hash) 
VALUES (extensions.crypt('PUT-THE-NEW-PASSWORD-HERE', extensions.gen_salt('bf')));

-- ====================================================================
-- 4. SEED ALL 10 DOMAINS AND ALL 150 EXACT CLUES
-- ====================================================================

-- Insert Domains
INSERT INTO public.domains (name, slug) VALUES
('Cybersecurity', 'cybersecurity'),
('Healthcare', 'healthcare'),
('Space Exploration', 'space-exploration'),
('Finance & Banking', 'finance-banking'),
('Education & Learning', 'education-learning'),
('Sports', 'sports'),
('Agriculture & Farming', 'agriculture-farming'),
('Transportation & Travel', 'transportation-travel'),
('Crime Investigation & Forensics', 'crime-investigation-forensics'),
('Artificial Intelligence', 'artificial-intelligence')
ON CONFLICT (name) DO UPDATE SET slug = EXCLUDED.slug;

-- Seed Clues Function to safely insert
DO $$
DECLARE
  d_cyber uuid;
  d_health uuid;
  d_space uuid;
  d_finance uuid;
  d_edu uuid;
  d_sports uuid;
  d_agri uuid;
  d_trans uuid;
  d_crime uuid;
  d_ai uuid;
BEGIN
  SELECT id INTO d_cyber FROM public.domains WHERE slug = 'cybersecurity';
  SELECT id INTO d_health FROM public.domains WHERE slug = 'healthcare';
  SELECT id INTO d_space FROM public.domains WHERE slug = 'space-exploration';
  SELECT id INTO d_finance FROM public.domains WHERE slug = 'finance-banking';
  SELECT id INTO d_edu FROM public.domains WHERE slug = 'education-learning';
  SELECT id INTO d_sports FROM public.domains WHERE slug = 'sports';
  SELECT id INTO d_agri FROM public.domains WHERE slug = 'agriculture-farming';
  SELECT id INTO d_trans FROM public.domains WHERE slug = 'transportation-travel';
  SELECT id INTO d_crime FROM public.domains WHERE slug = 'crime-investigation-forensics';
  SELECT id INTO d_ai FROM public.domains WHERE slug = 'artificial-intelligence';

  -- Domain 1: Cybersecurity
  INSERT INTO public.domain_clues (domain_id, clue_number, clue_text) VALUES
  (d_cyber, 1, 'The greatest weakness in a fortress may not be found in its walls.'),
  (d_cyber, 2, 'Trust can become a liability when it is given without verification.'),
  (d_cyber, 3, 'Some intrusions begin with an invitation that was never meant to be genuine.'),
  (d_cyber, 4, 'A secret can lose all its value the moment the wrong person learns it.'),
  (d_cyber, 5, 'The absence of visible damage does not prove that nothing was taken.'),
  (d_cyber, 6, 'A single overlooked weakness can undermine an otherwise carefully designed system.'),
  (d_cyber, 7, 'Identity and permission are two different questions, and confusing them can be costly.'),
  (d_cyber, 8, 'A message may imitate a familiar sender while concealing a different intention.'),
  (d_cyber, 9, 'A system can be manipulated through the very features designed to make it convenient.'),
  (d_cyber, 10, 'One compromised account can become a route into places its owner was never meant to access.'),
  (d_cyber, 11, 'Encryption, authentication, and access control address different parts of the same problem.'),
  (d_cyber, 12, 'Digital fingerprints, suspicious network traffic, and malicious code can reveal an intrusion.'),
  (d_cyber, 13, 'Ransomware can deny access to information without physically removing the device that stores it.'),
  (d_cyber, 14, 'Penetration testers deliberately probe systems for exploitable weaknesses before hostile actors find them.'),
  (d_cyber, 15, 'This field protects digital infrastructure and information against unauthorized access, disruption, and abuse.')
  ON CONFLICT (domain_id, clue_number) DO UPDATE SET clue_text = EXCLUDED.clue_text;

  -- Domain 2: Healthcare
  INSERT INTO public.domain_clues (domain_id, clue_number, clue_text) VALUES
  (d_health, 1, 'Two people can experience the same event and require very different responses.'),
  (d_health, 2, 'What appears insignificant today may become important when viewed alongside earlier observations.'),
  (d_health, 3, 'Waiting can sometimes be harmless, but in other circumstances it can change the outcome.'),
  (d_health, 4, 'The most useful answer is not always the one that explains the most obvious symptom.'),
  (d_health, 5, 'A pattern of small changes can reveal more than a single dramatic observation.'),
  (d_health, 6, 'Decisions often depend on balancing potential benefit against possible harm.'),
  (d_health, 7, 'An intervention may succeed even when its purpose is to prevent something that never becomes visible.'),
  (d_health, 8, 'Measurements taken at regular intervals can reveal a trend that one isolated reading cannot.'),
  (d_health, 9, 'A laboratory result, a personal history, and a physical examination may each tell a different part of the story.'),
  (d_health, 10, 'The same treatment may produce different outcomes depending on a person''s age, history, and circumstances.'),
  (d_health, 11, 'Screening can identify a possible problem before the individual notices anything unusual.'),
  (d_health, 12, 'A diagnosis is a reasoned conclusion drawn from evidence, not merely a name attached to a complaint.'),
  (d_health, 13, 'Immunization, rehabilitation, clinical monitoring, and patient records serve different purposes within the same broad system.'),
  (d_health, 14, 'Professionals use clinical evidence to guide prevention, diagnosis, treatment, and recovery.'),
  (d_health, 15, 'This field is concerned with preserving, restoring, and improving the physical and mental well-being of people.')
  ON CONFLICT (domain_id, clue_number) DO UPDATE SET clue_text = EXCLUDED.clue_text;

  -- Domain 3: Space Exploration
  INSERT INTO public.domain_clues (domain_id, clue_number, clue_text) VALUES
  (d_space, 1, 'A destination can be real even when it is inaccessible to ordinary travel.'),
  (d_space, 2, 'Distance changes not only the cost of a journey but also how quickly its consequences become known.'),
  (d_space, 3, 'A machine can gather evidence from a place its designers may never visit.'),
  (d_space, 4, 'Some journeys require careful planning long before the traveller begins moving.'),
  (d_space, 5, 'A small change in initial conditions can produce a dramatically different destination.'),
  (d_space, 6, 'Instruments can turn faint signals into evidence about objects that cannot be examined directly.'),
  (d_space, 7, 'Remaining in motion can sometimes be the key to remaining in place.'),
  (d_space, 8, 'The path of a moving object may be governed by a balance between forward motion and attraction.'),
  (d_space, 9, 'A vehicle may need to reach a particular speed and trajectory before its destination becomes achievable.'),
  (d_space, 10, 'Signals sent to distant machines may take long enough to arrive that immediate control is impossible.'),
  (d_space, 11, 'Some vehicles study the surfaces of other worlds, while others remain in orbit to observe or relay information.'),
  (d_space, 12, 'Microgravity, radiation exposure, and prolonged isolation create challenges unlike those of ordinary journeys.'),
  (d_space, 13, 'Telescopes and robotic probes can reveal the composition, history, and behaviour of distant celestial bodies.'),
  (d_space, 14, 'Missions may involve orbital laboratories, lunar exploration, planetary landings, and the return of samples from other worlds.'),
  (d_space, 15, 'This scientific and engineering endeavour sends people or machines beyond Earth''s atmosphere to investigate the universe.')
  ON CONFLICT (domain_id, clue_number) DO UPDATE SET clue_text = EXCLUDED.clue_text;

  -- Domain 4: Finance & Banking
  INSERT INTO public.domain_clues (domain_id, clue_number, clue_text) VALUES
  (d_finance, 1, 'A decision made today can restrict or expand tomorrow''s choices.'),
  (d_finance, 2, 'Something that appears profitable in isolation may become costly when time is considered.'),
  (d_finance, 3, 'A promise about the future is valuable only when the conditions supporting it are understood.'),
  (d_finance, 4, 'Keeping track of changes can be as important as knowing the current total.'),
  (d_finance, 5, 'A small percentage can produce a large difference when applied repeatedly over a long period.'),
  (d_finance, 6, 'Two choices with the same immediate outcome may have very different levels of uncertainty.'),
  (d_finance, 7, 'The ability to act now may depend on a history of decisions made long ago.'),
  (d_finance, 8, 'A person''s obligations can matter just as much as the resources currently available to them.'),
  (d_finance, 9, 'The passage of time can increase an outstanding obligation or grow an accumulated reserve.'),
  (d_finance, 10, 'Spreading exposure across different opportunities can reduce dependence on any single outcome.'),
  (d_finance, 11, 'A digital instruction can move value between accounts without transporting a physical object.'),
  (d_finance, 12, 'A record of repayment behaviour can influence whether someone is trusted with future borrowing.'),
  (d_finance, 13, 'Institutions in this field hold deposits, facilitate transfers, assess credit, and provide access to capital.'),
  (d_finance, 14, 'Analysts examine cash flow, exposure, repayment capacity, and unusual transactions to assess financial decisions and risks.'),
  (d_finance, 15, 'This field manages the movement, storage, borrowing, lending, and investment of money and other financial assets.')
  ON CONFLICT (domain_id, clue_number) DO UPDATE SET clue_text = EXCLUDED.clue_text;

  -- Domain 5: Education & Learning
  INSERT INTO public.domain_clues (domain_id, clue_number, clue_text) VALUES
  (d_edu, 1, 'Repetition can strengthen a habit without necessarily improving understanding.'),
  (d_edu, 2, 'A person may recognize an answer without being able to explain why it is correct.'),
  (d_edu, 3, 'Progress is difficult to measure when the destination has not been defined.'),
  (d_edu, 4, 'An error can be more informative than a correct response if it reveals the reasoning behind it.'),
  (d_edu, 5, 'The same information may need to be presented differently to produce the same result in different people.'),
  (d_edu, 6, 'What is remembered tomorrow depends partly on what was understood today.'),
  (d_edu, 7, 'Breaking a complex challenge into smaller parts can make progress easier to observe.'),
  (d_edu, 8, 'A well-designed question can distinguish genuine understanding from successful memorization.'),
  (d_edu, 9, 'Repeated retrieval can strengthen recall more effectively than repeatedly reviewing the same material.'),
  (d_edu, 10, 'A person''s next task can be selected using evidence from their previous performance.'),
  (d_edu, 11, 'Feedback becomes useful when it identifies a gap and offers a route to close it.'),
  (d_edu, 12, 'Some systems alter the difficulty or sequence of activities according to the learner''s responses.'),
  (d_edu, 13, 'Explanations, practice, assessment, and correction can form a continuous cycle rather than separate events.'),
  (d_edu, 14, 'Lesson plans, examinations, tutoring, and structured curricula are methods used to develop and evaluate a person''s abilities.'),
  (d_edu, 15, 'This process develops knowledge, skills, and understanding through instruction, experience, practice, and reflection.')
  ON CONFLICT (domain_id, clue_number) DO UPDATE SET clue_text = EXCLUDED.clue_text;

  -- Domain 6: Sports
  INSERT INTO public.domain_clues (domain_id, clue_number, clue_text) VALUES
  (d_sports, 1, 'Preparation can influence an outcome without guaranteeing it.'),
  (d_sports, 2, 'A result alone rarely explains the decisions that produced it.'),
  (d_sports, 3, 'The same strategy may succeed against one opponent and fail against another.'),
  (d_sports, 4, 'Small differences in timing can have consequences much larger than they appear.'),
  (d_sports, 5, 'A person''s strongest performance may depend on knowing when not to act.'),
  (d_sports, 6, 'Rest and recovery can contribute to improvement as much as repeated effort.'),
  (d_sports, 7, 'Rules transform individual ability into something that can be compared fairly.'),
  (d_sports, 8, 'Patterns in an opponent''s behaviour may reveal opportunities that raw strength cannot.'),
  (d_sports, 9, 'A coach may change a plan after observing a sequence of events rather than a single mistake.'),
  (d_sports, 10, 'Measurements of speed, accuracy, endurance, and positioning can expose strengths that casual observation misses.'),
  (d_sports, 11, 'Officials interpret rules, while competitors attempt to achieve an objective within those rules.'),
  (d_sports, 12, 'Rankings and statistics can describe performance, but they do not always explain its causes.'),
  (d_sports, 13, 'Substitutions, formations, pacing, and tactical adjustments can alter the course of a contest.'),
  (d_sports, 14, 'Training cycles, competitive fixtures, performance analysis, and regulated contests are central to this organised activity.'),
  (d_sports, 15, 'It is an organised form of physical or skill-based competition in which participants pursue defined outcomes under agreed rules.')
  ON CONFLICT (domain_id, clue_number) DO UPDATE SET clue_text = EXCLUDED.clue_text;

  -- Domain 7: Agriculture & Farming
  INSERT INTO public.domain_clues (domain_id, clue_number, clue_text) VALUES
  (d_agri, 1, 'A decision made during one short window can influence the result of an entire season.'),
  (d_agri, 2, 'More input does not necessarily produce more output.'),
  (d_agri, 3, 'The same intervention can help in one location and cause harm in another.'),
  (d_agri, 4, 'Conditions that cannot be controlled must still be accounted for in a successful plan.'),
  (d_agri, 5, 'A small change in the surrounding environment can alter the needs of a living system.'),
  (d_agri, 6, 'Observing early signs can prevent a minor problem from becoming a widespread one.'),
  (d_agri, 7, 'Different varieties may respond differently even when exposed to identical conditions.'),
  (d_agri, 8, 'Moisture, acidity, temperature, and nutrients influence what can grow successfully in a particular place.'),
  (d_agri, 9, 'A change in rainfall or the appearance of unfamiliar damage can require an immediate change of plan.'),
  (d_agri, 10, 'Patterns on leaves, stems, or fruit can help distinguish disease from nutritional stress.'),
  (d_agri, 11, 'Rotating what is grown in a particular area can influence soil health, pests, and future productivity.'),
  (d_agri, 12, 'Decisions about sowing, irrigation, fertilisation, pest control, and harvesting must often be coordinated with changing conditions.'),
  (d_agri, 13, 'Soil testing, weather forecasts, satellite imagery, and yield estimates can help guide decisions about fields.'),
  (d_agri, 14, 'Crop rotation, seed selection, water management, and the prevention of plant disease are established practices in this field.'),
  (d_agri, 15, 'This activity manages land, crops, and related biological resources to produce food, fibre, and other useful materials.')
  ON CONFLICT (domain_id, clue_number) DO UPDATE SET clue_text = EXCLUDED.clue_text;

  -- Domain 8: Transportation & Travel
  INSERT INTO public.domain_clues (domain_id, clue_number, clue_text) VALUES
  (d_trans, 1, 'The best path depends on what must be reached and what constraints apply.'),
  (d_trans, 2, 'A local delay can create consequences far beyond the point where it began.'),
  (d_trans, 3, 'Efficiency is not always the same as minimising distance.'),
  (d_trans, 4, 'A plan involving several connected stages can fail because of a problem at just one stage.'),
  (d_trans, 5, 'The value of a route depends on conditions that may change while it is being used.'),
  (d_trans, 6, 'Coordinating many moving parts requires more than choosing a starting point and an endpoint.'),
  (d_trans, 7, 'A small interruption can force a complete rearrangement of a larger schedule.'),
  (d_trans, 8, 'When demand exceeds available capacity, waiting and delay can spread through a network.'),
  (d_trans, 9, 'Different routes may trade speed against cost, reliability, safety, or convenience.'),
  (d_trans, 10, 'Schedules and transfer points must align if a journey is to proceed without unnecessary waiting.'),
  (d_trans, 11, 'Algorithms can calculate routes using distance, estimated time, restrictions, and changing conditions.'),
  (d_trans, 12, 'Fleet allocation and delivery sequencing can affect the efficiency of an entire operation.'),
  (d_trans, 13, 'Reservations, timetables, fares, vehicle availability, and passenger requirements must often be coordinated.'),
  (d_trans, 14, 'Navigation, itinerary planning, traffic estimation, freight distribution, and route optimisation are applications of this field.'),
  (d_trans, 15, 'It concerns the planned movement of people or goods between locations, including the networks and services that make those journeys possible.')
  ON CONFLICT (domain_id, clue_number) DO UPDATE SET clue_text = EXCLUDED.clue_text;

  -- Domain 9: Crime Investigation & Forensics
  INSERT INTO public.domain_clues (domain_id, clue_number, clue_text) VALUES
  (d_crime, 1, 'The most plausible explanation is not necessarily the correct one.'),
  (d_crime, 2, 'An observation becomes more useful when its origin and reliability can be established.'),
  (d_crime, 3, 'Two accounts may contradict each other without either contradiction immediately revealing the truth.'),
  (d_crime, 4, 'A missing piece of information can be significant, but it cannot automatically establish what happened.'),
  (d_crime, 5, 'The order in which events occurred may matter as much as the events themselves.'),
  (d_crime, 6, 'A conclusion can become unreliable if the material supporting it has been altered or poorly documented.'),
  (d_crime, 7, 'Several weak observations may become meaningful when they independently support the same explanation.'),
  (d_crime, 8, 'An overlooked trace can connect locations, objects, and individuals that initially appear unrelated.'),
  (d_crime, 9, 'Investigators compare timelines, statements, physical traces, and recorded activity to test competing explanations.'),
  (d_crime, 10, 'Microscopic fibres, biological material, fingerprints, and device records can provide leads, but each requires careful interpretation.'),
  (d_crime, 11, 'The documented history of who collected, transferred, stored, and examined an item can affect whether its findings are trusted.'),
  (d_crime, 12, 'Specialists may reconstruct events by examining physical material, documents, recordings, and electronic devices.'),
  (d_crime, 13, 'Investigators distinguish between a hypothesis, a supporting observation, and a conclusion that the available evidence can justify.'),
  (d_crime, 14, 'Evidence preservation, laboratory examination, event reconstruction, and corroboration are used to investigate suspected offences.'),
  (d_crime, 15, 'This work applies systematic investigation and scientific examination to establish facts about suspected unlawful acts.')
  ON CONFLICT (domain_id, clue_number) DO UPDATE SET clue_text = EXCLUDED.clue_text;

  -- Domain 10: Artificial Intelligence
  INSERT INTO public.domain_clues (domain_id, clue_number, clue_text) VALUES
  (d_ai, 1, 'A system may produce a useful result even when its designer has not specified every possible response in advance.'),
  (d_ai, 2, 'A successful output can conceal a flawed process, just as a failed output can reveal a useful limitation.'),
  (d_ai, 3, 'The same input can produce different outcomes when the context or assumptions change.'),
  (d_ai, 4, 'A system''s apparent confidence does not guarantee that its conclusion is correct.'),
  (d_ai, 5, 'Examples can help a system recognise patterns that were not explicitly described as individual rules.'),
  (d_ai, 6, 'Some tasks can be performed by estimating what is most likely, rather than following a fixed sequence of instructions.'),
  (d_ai, 7, 'A useful tool may assist with a decision without being capable of accepting responsibility for it.'),
  (d_ai, 8, 'A system can classify unfamiliar inputs by comparing their characteristics with patterns learned previously.'),
  (d_ai, 9, 'Predictions and recommendations can be generated from relationships found in historical data.'),
  (d_ai, 10, 'A model may interpret instructions, produce a response, or transform one kind of information into another.'),
  (d_ai, 11, 'Training, inference, neural networks, and machine learning are concepts associated with methods used in this field.'),
  (d_ai, 12, 'Applications include recognising speech, interpreting images, generating text, forecasting outcomes, and assisting with decisions.'),
  (d_ai, 13, 'Some systems create new material, while others estimate outcomes, identify patterns, plan actions, or classify information.'),
  (d_ai, 14, 'Developers can integrate trained models into software to perform tasks involving perception, language, prediction, and reasoning.'),
  (d_ai, 15, 'This field of computing develops systems designed to perform tasks commonly associated with human cognitive abilities.')
  ON CONFLICT (domain_id, clue_number) DO UPDATE SET clue_text = EXCLUDED.clue_text;
END $$;

-- ====================================================================
-- 5. SECURE SERVER-SIDE RPC FUNCTIONS
-- ====================================================================

-- A. Helper function: normalize and check domain guess
CREATE OR REPLACE FUNCTION public.check_domain_match(p_guess text, p_domain_slug text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  clean_guess text;
BEGIN
  -- Normalize: lower, trim, collapse spaces, remove hyphens and ampersands
  clean_guess := lower(trim(p_guess));
  clean_guess := regexp_replace(clean_guess, '[^a-z0-9 ]', ' ', 'g');
  clean_guess := regexp_replace(clean_guess, '\s+', ' ', 'g');
  clean_guess := trim(clean_guess);

  CASE p_domain_slug
    WHEN 'cybersecurity' THEN
      RETURN clean_guess IN (
        'cybersecurity', 'cyber security', 'cyber', 'infosec', 'info sec',
        'information security', 'network security', 'computer security',
        'cyber defense', 'cyber defence', 'cyber safety', 'cyber attack',
        'cyber security and defense', 'ethical hacking', 'hacking',
        'it security', 'data security', 'penetration testing', 'pen testing',
        'appsec', 'application security', 'cloud security'
      );
    WHEN 'healthcare' THEN
      RETURN clean_guess IN (
        'healthcare', 'health care', 'health', 'medicine', 'medical',
        'medical science', 'clinical', 'hospital', 'hospitals', 'public health',
        'healthcare and medicine', 'health and medicine', 'medical care',
        'doctor', 'patient care', 'health sciences', 'health science',
        'biomedical', 'pharmacy', 'pharmaceutical', 'pharma', 'medtech',
        'health tech', 'healthtech'
      );
    WHEN 'space-exploration' THEN
      RETURN clean_guess IN (
        'space exploration', 'space', 'astronomy', 'space travel', 'aerospace',
        'outer space', 'space science', 'space research', 'space technology',
        'astrophysics', 'cosmology', 'astronautics', 'cosmonautics',
        'rocket science', 'rocketry', 'planetary science', 'aeronautics'
      );
    WHEN 'finance-banking' THEN
      RETURN clean_guess IN (
        'finance banking', 'finance and banking', 'finance', 'banking',
        'financial services', 'financial', 'bank', 'banks', 'fintech',
        'fin tech', 'investment banking', 'investment', 'investing',
        'financial management', 'economics', 'economy', 'wealth management',
        'commercial banking', 'personal finance', 'corporate finance',
        'money management'
      );
    WHEN 'education-learning' THEN
      RETURN clean_guess IN (
        'education learning', 'education and learning', 'education', 'learning',
        'teaching', 'educational', 'edtech', 'ed tech', 'pedagogy',
        'academics', 'academic', 'schooling', 'e learning', 'elearning',
        'higher education', 'instruction'
      );
    WHEN 'sports' THEN
      RETURN clean_guess IN (
        'sports', 'sport', 'athletics', 'athletic', 'sporting', 'fitness',
        'physical education', 'sports science', 'sports and athletics',
        'athletics and sports', 'esports', 'e sports', 'physical training'
      );
    WHEN 'agriculture-farming' THEN
      RETURN clean_guess IN (
        'agriculture farming', 'agriculture and farming', 'agriculture',
        'farming', 'agritech', 'agri tech', 'agricultural', 'agribusiness',
        'agri business', 'agronomy', 'cultivation', 'farming and agriculture',
        'crop production', 'horticulture', 'agriculture science',
        'agricultural science', 'farming technology'
      );
    WHEN 'transportation-travel' THEN
      RETURN clean_guess IN (
        'transportation travel', 'transportation and travel', 'transportation',
        'travel', 'transport', 'logistics', 'transit', 'public transit',
        'public transportation', 'public transport', 'mobility',
        'travel and tourism', 'travel and transportation', 'tourism',
        'freight', 'shipping', 'fleet management', 'traffic management',
        'aviation and transport'
      );
    WHEN 'crime-investigation-forensics' THEN
      RETURN clean_guess IN (
        'crime investigation forensics', 'crime investigation and forensics',
        'crime investigation', 'criminal investigation', 'crime', 'crimes',
        'investigation', 'investigations', 'forensics', 'forensic',
        'forensic science', 'criminology', 'criminalistics', 'detective',
        'detectives', 'criminal', 'crime scene investigation', 'csi',
        'digital forensics', 'police investigation', 'criminal justice',
        'law enforcement', 'forensic investigation', 'crime and forensics',
        'crime forensics', 'criminal forensics', 'crime detection'
      );
    WHEN 'artificial-intelligence' THEN
      RETURN clean_guess IN (
        'artificial intelligence', 'ai', 'a i', 'machine learning', 'ml', 'm l',
        'deep learning', 'dl', 'd l', 'neural networks', 'neural network',
        'generative ai', 'gen ai', 'genai', 'artificial general intelligence',
        'agi', 'a g i', 'data science', 'natural language processing', 'nlp',
        'computer vision', 'ai and ml', 'ai ml'
      );
    ELSE
      RETURN false;
  END CASE;
END;
$$;

-- B. register_or_resume_participant
CREATE OR REPLACE FUNCTION public.register_or_resume_participant(p_name text, p_participant_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_participant public.participants%ROWTYPE;
  v_session public.game_sessions%ROWTYPE;
  v_chosen_domain_id uuid;
  v_resumed boolean := false;
BEGIN
  -- 1. Find or create participant
  SELECT * INTO v_participant FROM public.participants WHERE participant_id = p_participant_id;
  IF FOUND THEN
    v_resumed := true;
  ELSE
    INSERT INTO public.participants (name, participant_id)
    VALUES (p_name, p_participant_id)
    RETURNING * INTO v_participant;
  END IF;

  -- 2. Check if a game_session exists for this participant
  SELECT * INTO v_session FROM public.game_sessions WHERE participant_id = v_participant.id;
  IF NOT FOUND THEN
    -- Balanced random assignment: select among domains with the fewest active sessions
    WITH domain_counts AS (
      SELECT d.id, COUNT(gs.id) AS assignment_count
      FROM public.domains d
      LEFT JOIN public.game_sessions gs ON gs.assigned_domain_id = d.id
      GROUP BY d.id
    ),
    min_count AS (
      SELECT MIN(assignment_count) AS min_val FROM domain_counts
    ),
    candidates AS (
      SELECT dc.id FROM domain_counts dc
      JOIN min_count mc ON dc.assignment_count = mc.min_val
    )
    SELECT id INTO v_chosen_domain_id
    FROM candidates
    ORDER BY random()
    LIMIT 1;

    INSERT INTO public.game_sessions (
      participant_id,
      assigned_domain_id,
      round_status,
      player_status,
      current_clue,
      wrong_guess_count,
      score
    ) VALUES (
      v_participant.id,
      v_chosen_domain_id,
      'NOT_STARTED',
      'NORMAL',
      0,
      0,
      0
    )
    RETURNING * INTO v_session;
  END IF;

  RETURN json_build_object(
    'id', v_participant.id,
    'session_token', v_participant.session_token,
    'name', v_participant.name,
    'participant_id', v_participant.participant_id,
    'round_status', v_session.round_status,
    'player_status', v_session.player_status,
    'current_clue', v_session.current_clue,
    'wrong_guess_count', v_session.wrong_guess_count,
    'score', v_session.score,
    'started_at', v_session.started_at,
    'completed_at', v_session.completed_at,
    'resumed', v_resumed
  );
END;
$$;

-- C. begin_round
CREATE OR REPLACE FUNCTION public.begin_round(p_session_token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_participant public.participants%ROWTYPE;
  v_session public.game_sessions%ROWTYPE;
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

  IF v_session.round_status = 'NOT_STARTED' THEN
    UPDATE public.game_sessions
    SET round_status = 'ACTIVE',
        current_clue = 1,
        started_at = now(),
        updated_at = now()
    WHERE id = v_session.id
    RETURNING * INTO v_session;
  END IF;

  -- Fetch Clue 1
  SELECT clue_text INTO v_clue_text
  FROM public.domain_clues
  WHERE domain_id = v_session.assigned_domain_id AND clue_number = 1;

  RETURN json_build_object(
    'round_status', v_session.round_status,
    'player_status', v_session.player_status,
    'current_clue', v_session.current_clue,
    'wrong_guess_count', v_session.wrong_guess_count,
    'score', v_session.score,
    'clue_number', 1,
    'clue_text', v_clue_text
  );
END;
$$;

-- D. reveal_next_clue
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

-- E. submit_guess
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

-- F. get_game_state
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
      'elapsed_seconds', v_elapsed_seconds,
      'time_remaining_seconds', GREATEST(0, 900 - v_elapsed_seconds),
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
      'elapsed_seconds', v_elapsed_seconds,
      'time_remaining_seconds', GREATEST(0, 900 - v_elapsed_seconds),
      'unlocked_clues', v_clues,
      'guesses', v_guesses
    );
  END IF;
END;
$$;

-- F2. timeout_round (Manual or Frontend-Triggered Countdown Expiration)
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

-- G. get_admin_dashboard
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

-- H. get_admin_participant_details
CREATE OR REPLACE FUNCTION public.get_admin_participant_details(admin_pwd text, p_session_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  pwd_hash text;
  v_session public.game_sessions%ROWTYPE;
  v_participant public.participants%ROWTYPE;
  v_domain public.domains%ROWTYPE;
  v_all_clues json;
  v_guesses json;
  v_penalties json;
  v_audit_logs json;
BEGIN
  SELECT password_hash INTO pwd_hash FROM public.admin_config LIMIT 1;
  IF pwd_hash IS NULL OR extensions.crypt(admin_pwd, pwd_hash) != pwd_hash THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT * INTO v_session FROM public.game_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'session_not_found');
  END IF;

  SELECT * INTO v_participant FROM public.participants WHERE id = v_session.participant_id;
  SELECT * INTO v_domain FROM public.domains WHERE id = v_session.assigned_domain_id;

  -- All 15 clues for that domain
  SELECT COALESCE(json_agg(
    json_build_object(
      'clue_number', clue_number,
      'clue_text', clue_text,
      'unlocked', (clue_number <= v_session.current_clue)
    ) ORDER BY clue_number
  ), '[]'::json) INTO v_all_clues
  FROM public.domain_clues
  WHERE domain_id = v_domain.id;

  -- Guess history
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

  -- Penalty history
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', id,
      'penalty_type', penalty_type,
      'status', status,
      'created_at', created_at,
      'resolved_at', resolved_at,
      'resolved_by', resolved_by
    ) ORDER BY created_at DESC
  ), '[]'::json) INTO v_penalties
  FROM public.penalty_history
  WHERE game_session_id = v_session.id;

  -- Audit logs
  SELECT COALESCE(json_agg(
    json_build_object(
      'admin_id', admin_id,
      'action', action,
      'created_at', created_at
    ) ORDER BY created_at DESC
  ), '[]'::json) INTO v_audit_logs
  FROM public.admin_audit_log
  WHERE game_session_id = v_session.id;

  RETURN json_build_object(
    'session_id', v_session.id,
    'participant_name', v_participant.name,
    'participant_id', v_participant.participant_id,
    'assigned_domain_name', v_domain.name,
    'assigned_domain_slug', v_domain.slug,
    'round_status', v_session.round_status,
    'player_status', v_session.player_status,
    'current_clue', v_session.current_clue,
    'wrong_guess_count', v_session.wrong_guess_count,
    'score', v_session.score,
    'started_at', v_session.started_at,
    'completed_at', v_session.completed_at,
    'clues', v_all_clues,
    'guesses', v_guesses,
    'penalties', v_penalties,
    'audit_logs', v_audit_logs
  );
END;
$$;

-- I. resolve_penalty
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

-- ====================================================================
-- 6. GRANT EXECUTE ON RPC FUNCTIONS TO CLIENT ROLES
-- ====================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.check_domain_match TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_or_resume_participant TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_round TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reveal_next_clue TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_guess TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_game_state TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.timeout_round TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_participant_details TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_penalty TO anon, authenticated;

-- ====================================================================
-- END OF SCRIPT
-- ====================================================================
