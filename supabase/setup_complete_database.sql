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
  (d_cyber, 1, 'A boundary is only useful if it can distinguish what belongs inside from what does not.'),
  (d_cyber, 2, 'Some of the most valuable things people possess cannot be held in their hands.'),
  (d_cyber, 3, 'A single mistake can expose something that took years to build.'),
  (d_cyber, 4, 'Attackers often prefer exploiting trust over defeating strength.'),
  (d_cyber, 5, 'The weakest point in a complex system may be the person using it.'),
  (d_cyber, 6, 'One convincing message can open a door that no physical key could unlock.'),
  (d_cyber, 7, 'Not every threat announces itself; some remain unnoticed while collecting information.'),
  (d_cyber, 8, 'A harmless-looking attachment can become the beginning of a serious incident.'),
  (d_cyber, 9, 'An organization may be compromised without losing a single physical object.'),
  (d_cyber, 10, 'A stolen password can sometimes be more valuable than a stolen computer.'),
  (d_cyber, 11, 'Firewalls, encryption, and access controls help defend connected systems.'),
  (d_cyber, 12, 'Phishing tricks people into revealing confidential information.'),
  (d_cyber, 13, 'Malware, ransomware, and unauthorized access are threats this field investigates.'),
  (d_cyber, 14, 'Security professionals perform penetration tests to discover weaknesses before attackers exploit them.'),
  (d_cyber, 15, 'Its central mission is to protect digital systems, networks, and information from attacks.')
  ON CONFLICT (domain_id, clue_number) DO UPDATE SET clue_text = EXCLUDED.clue_text;

  -- Domain 2: Healthcare
  INSERT INTO public.domain_clues (domain_id, clue_number, clue_text) VALUES
  (d_health, 1, 'The same warning sign can mean different things depending on the person experiencing it.'),
  (d_health, 2, 'Time can change the outcome of a problem even when its cause remains the same.'),
  (d_health, 3, 'Information gathered early can prevent a much larger problem later.'),
  (d_health, 4, 'A useful decision often depends on understanding both the individual and their history.'),
  (d_health, 5, 'Two people with identical complaints may require different approaches.'),
  (d_health, 6, 'Prevention can be more effective than waiting until a problem becomes severe.'),
  (d_health, 7, 'Records, observations, and expert judgment often need to work together.'),
  (d_health, 8, 'A person''s temperature, pulse, and blood pressure can reveal important changes.'),
  (d_health, 9, 'Symptoms may help narrow down possible causes, but they do not always establish one.'),
  (d_health, 10, 'Medical images and laboratory reports provide evidence that specialists interpret.'),
  (d_health, 11, 'Doctors, nurses, laboratories, and hospitals all contribute to this field.'),
  (d_health, 12, 'Vaccination, screening, and early detection can reduce the impact of disease.'),
  (d_health, 13, 'Patient records help professionals understand medical history and treatment.'),
  (d_health, 14, 'Diagnosis, treatment, rehabilitation, and disease prevention are central activities here.'),
  (d_health, 15, 'Its primary purpose is to maintain and improve human health.')
  ON CONFLICT (domain_id, clue_number) DO UPDATE SET clue_text = EXCLUDED.clue_text;

  -- Domain 3: Space Exploration
  INSERT INTO public.domain_clues (domain_id, clue_number, clue_text) VALUES
  (d_space, 1, 'Some of the most important destinations cannot be reached by taking an ordinary road.'),
  (d_space, 2, 'Distance can make even a short message arrive much later than expected.'),
  (d_space, 3, 'The environment beyond a familiar boundary can demand entirely different survival strategies.'),
  (d_space, 4, 'Instruments can reveal places that human senses cannot directly examine.'),
  (d_space, 5, 'A small error in direction can become enormous over a sufficiently long journey.'),
  (d_space, 6, 'Some discoveries require machines to travel where people cannot easily go.'),
  (d_space, 7, 'The path taken can matter just as much as the destination.'),
  (d_space, 8, 'Objects can remain in orbit without continuously using their engines.'),
  (d_space, 9, 'A launch vehicle must overcome gravity to send its payload on a suitable trajectory.'),
  (d_space, 10, 'Satellites can observe Earth, relay communications, and study distant objects.'),
  (d_space, 11, 'Rovers explore surfaces where ordinary vehicles and human explorers may not be practical.'),
  (d_space, 12, 'Astronauts train for microgravity, radiation, isolation, and limited resources.'),
  (d_space, 13, 'Telescopes reveal stars, planets, galaxies, and other distant celestial objects.'),
  (d_space, 14, 'Missions may involve lunar landings, planetary probes, orbital stations, and sample collection.'),
  (d_space, 15, 'Its central goal is to explore beyond Earth and investigate the universe using scientific instruments and spacecraft.')
  ON CONFLICT (domain_id, clue_number) DO UPDATE SET clue_text = EXCLUDED.clue_text;

  -- Domain 4: Finance & Banking
  INSERT INTO public.domain_clues (domain_id, clue_number, clue_text) VALUES
  (d_finance, 1, 'Having more resources today does not guarantee having enough tomorrow.'),
  (d_finance, 2, 'Every choice involving limited resources usually has an opportunity cost.'),
  (d_finance, 3, 'Trust matters when one person gives up control of something valuable to another.'),
  (d_finance, 4, 'A record of past decisions can influence what options become available later.'),
  (d_finance, 5, 'Small recurring losses can become significant when they accumulate over time.'),
  (d_finance, 6, 'Predicting the future is useful here, but uncertainty can never be eliminated entirely.'),
  (d_finance, 7, 'A transaction may be legitimate, mistaken, or deliberately deceptive.'),
  (d_finance, 8, 'A person''s income, spending, and obligations determine how much flexibility they have.'),
  (d_finance, 9, 'Interest changes the cost of borrowing and the return on saving.'),
  (d_finance, 10, 'Diversification can help manage the risks associated with investments.'),
  (d_finance, 11, 'Digital transfers move value between accounts without physical cash changing hands.'),
  (d_finance, 12, 'Credit scores and repayment histories can affect access to loans.'),
  (d_finance, 13, 'Banks manage deposits, payments, lending, and other financial services.'),
  (d_finance, 14, 'Fraud detection systems look for unusual transaction patterns and suspicious activity.'),
  (d_finance, 15, 'Its central concern is managing money, payments, credit, savings, and investments.')
  ON CONFLICT (domain_id, clue_number) DO UPDATE SET clue_text = EXCLUDED.clue_text;

  -- Domain 5: Education & Learning
  INSERT INTO public.domain_clues (domain_id, clue_number, clue_text) VALUES
  (d_edu, 1, 'Repeating an activity does not guarantee that a person will improve at it.'),
  (d_edu, 2, 'The same explanation can be clear to one person and confusing to another.'),
  (d_edu, 3, 'Mistakes can provide useful information about what someone has not yet understood.'),
  (d_edu, 4, 'Progress becomes easier to measure when expectations are clearly defined.'),
  (d_edu, 5, 'Feedback is most useful when it explains what went wrong and what to do next.'),
  (d_edu, 6, 'A person''s existing knowledge affects how quickly they understand a new idea.'),
  (d_edu, 7, 'Breaking a complex task into smaller steps can make it easier to master.'),
  (d_edu, 8, 'A well-designed question can reveal understanding better than memorizing a definition.'),
  (d_edu, 9, 'Practice tests help identify knowledge gaps before a final assessment.'),
  (d_edu, 10, 'Spaced repetition helps people retain information over longer periods.'),
  (d_edu, 11, 'Teachers, learners, assignments, and assessments are common parts of this process.'),
  (d_edu, 12, 'Adaptive systems can adjust the difficulty of exercises based on a learner''s performance.'),
  (d_edu, 13, 'A tutor may explain the same concept differently depending on the student''s confusion.'),
  (d_edu, 14, 'Courses, classrooms, examinations, and learning management systems support this activity.'),
  (d_edu, 15, 'Its primary purpose is to develop knowledge, skills, understanding, and the ability to apply them.')
  ON CONFLICT (domain_id, clue_number) DO UPDATE SET clue_text = EXCLUDED.clue_text;

  -- Domain 6: Sports
  INSERT INTO public.domain_clues (domain_id, clue_number, clue_text) VALUES
  (d_sports, 1, 'Natural ability can create an advantage, but it rarely replaces consistent preparation.'),
  (d_sports, 2, 'A measurable result does not always explain why it happened.'),
  (d_sports, 3, 'Conditions outside an individual''s control can influence the final outcome.'),
  (d_sports, 4, 'Small improvements in repeated actions can create a significant advantage over time.'),
  (d_sports, 5, 'Strategy often involves predicting what another person or team will do.'),
  (d_sports, 6, 'Recovery is part of performance, not merely time away from activity.'),
  (d_sports, 7, 'Rules define what counts as success and what counts as a violation.'),
  (d_sports, 8, 'Reaction time, accuracy, endurance, and coordination can affect performance.'),
  (d_sports, 9, 'Coaches use practice sessions and recorded performances to identify weaknesses.'),
  (d_sports, 10, 'A competitor may study an opponent''s previous results to plan a strategy.'),
  (d_sports, 11, 'Referees and officials enforce rules during organized competitions.'),
  (d_sports, 12, 'Scores, rankings, statistics, and records help compare performances.'),
  (d_sports, 13, 'Teams may use data to evaluate player contributions and make tactical decisions.'),
  (d_sports, 14, 'Training plans, tournaments, fitness monitoring, and performance analysis are central activities.'),
  (d_sports, 15, 'Its defining feature is organized physical or skill-based competition, governed by rules and measured through performance.')
  ON CONFLICT (domain_id, clue_number) DO UPDATE SET clue_text = EXCLUDED.clue_text;

  -- Domain 7: Agriculture & Farming
  INSERT INTO public.domain_clues (domain_id, clue_number, clue_text) VALUES
  (d_agri, 1, 'A successful outcome can depend on conditions that change from day to day.'),
  (d_agri, 2, 'Decisions made early can affect results months later.'),
  (d_agri, 3, 'Using more resources does not always produce a better outcome.'),
  (d_agri, 4, 'A small problem left unnoticed can spread across a much larger area.'),
  (d_agri, 5, 'Local knowledge can be as valuable as information collected by sophisticated instruments.'),
  (d_agri, 6, 'Timing matters because some opportunities cannot simply be postponed indefinitely.'),
  (d_agri, 7, 'Different varieties may respond differently to the same conditions.'),
  (d_agri, 8, 'Soil moisture, temperature, and nutrient levels influence biological growth.'),
  (d_agri, 9, 'An unexpected change in rainfall can disrupt an entire production plan.'),
  (d_agri, 10, 'Leaves with unusual spots or discoloration may indicate a disease or deficiency.'),
  (d_agri, 11, 'Irrigation schedules and pest management affect both productivity and resource use.'),
  (d_agri, 12, 'Farmers must often decide when to sow, water, fertilize, and harvest.'),
  (d_agri, 13, 'Satellite images and weather forecasts can help monitor fields and plan activities.'),
  (d_agri, 14, 'Crop rotation, soil management, seed selection, and yield estimation are important practices here.'),
  (d_agri, 15, 'Its central purpose is to cultivate crops and manage related biological resources to produce food and other useful materials.')
  ON CONFLICT (domain_id, clue_number) DO UPDATE SET clue_text = EXCLUDED.clue_text;

  -- Domain 8: Transportation & Travel
  INSERT INTO public.domain_clues (domain_id, clue_number, clue_text) VALUES
  (d_trans, 1, 'The shortest option is not always the most practical one.'),
  (d_trans, 2, 'A plan that works under ideal conditions may fail when circumstances change.'),
  (d_trans, 3, 'Moving something from one place to another involves trade-offs between time, cost, and reliability.'),
  (d_trans, 4, 'Coordination becomes more difficult when many people or resources share limited space.'),
  (d_trans, 5, 'A delay in one location can affect a chain of later activities.'),
  (d_trans, 6, 'The best decision depends partly on where someone starts and where they need to end up.'),
  (d_trans, 7, 'Unexpected events can make a previously optimal plan inefficient.'),
  (d_trans, 8, 'Congestion occurs when demand exceeds the available capacity of a route.'),
  (d_trans, 9, 'Navigation systems calculate routes using locations, distances, and road conditions.'),
  (d_trans, 10, 'Public transit schedules help coordinate passengers, vehicles, and stops.'),
  (d_trans, 11, 'Airlines, railways, road networks, and shipping systems all move people or goods.'),
  (d_trans, 12, 'Route optimization can reduce travel time, fuel consumption, or delivery costs.'),
  (d_trans, 13, 'Booking systems coordinate availability, schedules, fares, and reservations.'),
  (d_trans, 14, 'Trip itineraries, fleet management, traffic prediction, and logistics are common applications.'),
  (d_trans, 15, 'Its central purpose is to move people or goods between locations efficiently and reliably.')
  ON CONFLICT (domain_id, clue_number) DO UPDATE SET clue_text = EXCLUDED.clue_text;

  -- Domain 9: Crime Investigation & Forensics
  INSERT INTO public.domain_clues (domain_id, clue_number, clue_text) VALUES
  (d_crime, 1, 'What appears obvious at first may not survive closer examination.'),
  (d_crime, 2, 'An object can provide information beyond its intended purpose.'),
  (d_crime, 3, 'A timeline can expose contradictions between different accounts.'),
  (d_crime, 4, 'The absence of evidence does not automatically prove that an event never occurred.'),
  (d_crime, 5, 'Two unrelated observations may become meaningful when connected carefully.'),
  (d_crime, 6, 'Preserving the original state of information can be as important as interpreting it.'),
  (d_crime, 7, 'A conclusion is only as reliable as the evidence and reasoning supporting it.'),
  (d_crime, 8, 'Tiny traces may connect a person, object, and location.'),
  (d_crime, 9, 'Investigators compare statements, timestamps, records, and physical observations.'),
  (d_crime, 10, 'Fingerprints, DNA, fibres, and digital logs may provide investigative leads.'),
  (d_crime, 11, 'A chain of custody records who handled evidence and when.'),
  (d_crime, 12, 'Experts may examine devices, documents, biological samples, and other traces.'),
  (d_crime, 13, 'Digital records can help reconstruct sequences of events, but they must be interpreted carefully.'),
  (d_crime, 14, 'Investigators use evidence collection, laboratory analysis, reconstruction, and corroboration to examine suspected offences.'),
  (d_crime, 15, 'Its purpose is to establish facts about suspected crimes through systematic investigation and scientific examination of evidence.')
  ON CONFLICT (domain_id, clue_number) DO UPDATE SET clue_text = EXCLUDED.clue_text;

  -- Domain 10: Artificial Intelligence
  INSERT INTO public.domain_clues (domain_id, clue_number, clue_text) VALUES
  (d_ai, 1, 'A system can produce useful results without following a manually written rule for every possible situation.'),
  (d_ai, 2, 'Patterns in previous observations can help a system respond to unfamiliar inputs.'),
  (d_ai, 3, 'The quality of an output depends partly on the quality of the information supplied.'),
  (d_ai, 4, 'A convincing answer is not necessarily a correct answer.'),
  (d_ai, 5, 'Some systems improve through examples rather than explicit instructions for every case.'),
  (d_ai, 6, 'Tasks once associated mainly with human judgment can sometimes be assisted by computation.'),
  (d_ai, 7, 'The goal is not always to replace a person; sometimes it is to help them make better decisions.'),
  (d_ai, 8, 'A model can classify an incoming item based on patterns learned from earlier examples.'),
  (d_ai, 9, 'A recommendation system can estimate which option a user is likely to prefer.'),
  (d_ai, 10, 'A conversational system can interpret prompts and generate contextually relevant responses.'),
  (d_ai, 11, 'Machine learning, neural networks, and inference are techniques associated with this field.'),
  (d_ai, 12, 'Image recognition, speech processing, prediction, and text generation are common applications.'),
  (d_ai, 13, 'Some systems generate new content, while others classify, predict, plan, or make recommendations.'),
  (d_ai, 14, 'Developers integrate trained models into applications to automate tasks that involve language, perception, reasoning, or prediction.'),
  (d_ai, 15, 'It is the field of computing concerned with creating systems capable of performing tasks that typically require human-like intelligence.')
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
      RETURN clean_guess IN ('cybersecurity', 'cyber security', 'infosec', 'information security', 'network security');
    WHEN 'healthcare' THEN
      RETURN clean_guess IN ('healthcare', 'health care', 'medicine', 'medical', 'health');
    WHEN 'space-exploration' THEN
      RETURN clean_guess IN ('space exploration', 'space', 'astronomy', 'space travel', 'aerospace');
    WHEN 'finance-banking' THEN
      RETURN clean_guess IN ('finance banking', 'finance and banking', 'finance', 'banking', 'financial services');
    WHEN 'education-learning' THEN
      RETURN clean_guess IN ('education learning', 'education and learning', 'education', 'learning', 'teaching');
    WHEN 'sports' THEN
      RETURN clean_guess IN ('sports', 'sport', 'athletics');
    WHEN 'agriculture-farming' THEN
      RETURN clean_guess IN ('agriculture farming', 'agriculture and farming', 'agriculture', 'farming', 'agritech');
    WHEN 'transportation-travel' THEN
      RETURN clean_guess IN ('transportation travel', 'transportation and travel', 'transportation', 'travel', 'transport', 'logistics');
    WHEN 'crime-investigation-forensics' THEN
      RETURN clean_guess IN ('crime investigation forensics', 'crime investigation and forensics', 'crime investigation', 'forensics', 'criminal investigation', 'forensic science');
    WHEN 'artificial-intelligence' THEN
      RETURN clean_guess IN ('artificial intelligence', 'ai', 'machine learning');
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
