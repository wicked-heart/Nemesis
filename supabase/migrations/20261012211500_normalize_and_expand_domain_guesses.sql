-- ====================================================================
-- NEMESIS — MIGRATION: NORMALIZE & EXPAND DOMAIN GUESS WORDS
-- Adds commonly used synonyms, root terms (e.g. 'crime', 'investigation'),
-- abbreviations (e.g. 'csi', 'a i', 'ml'), and domain aliases.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.check_domain_match(p_guess text, p_domain_slug text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  clean_guess text;
BEGIN
  -- Normalize: lower, trim, collapse spaces, strip punctuation/symbols into spaces
  clean_guess := lower(trim(p_guess));
  clean_guess := regexp_replace(clean_guess, '[^a-z0-9 ]', ' ', 'g');
  clean_guess := regexp_replace(clean_guess, '\s+', ' ', 'g');
  clean_guess := trim(clean_guess);

  CASE p_domain_slug
    -- 1. Cybersecurity
    WHEN 'cybersecurity' THEN
      RETURN clean_guess IN (
        'cybersecurity', 'cyber security', 'cyber', 'infosec', 'info sec',
        'information security', 'network security', 'computer security',
        'cyber defense', 'cyber defence', 'cyber safety', 'cyber attack',
        'cyber security and defense', 'ethical hacking', 'hacking',
        'it security', 'data security', 'penetration testing', 'pen testing',
        'appsec', 'application security', 'cloud security'
      );

    -- 2. Healthcare
    WHEN 'healthcare' THEN
      RETURN clean_guess IN (
        'healthcare', 'health care', 'health', 'medicine', 'medical',
        'medical science', 'clinical', 'hospital', 'hospitals', 'public health',
        'healthcare and medicine', 'health and medicine', 'medical care',
        'doctor', 'patient care', 'health sciences', 'health science',
        'biomedical', 'pharmacy', 'pharmaceutical', 'pharma', 'medtech',
        'health tech', 'healthtech'
      );

    -- 3. Space Exploration
    WHEN 'space-exploration' THEN
      RETURN clean_guess IN (
        'space exploration', 'space', 'astronomy', 'space travel', 'aerospace',
        'outer space', 'space science', 'space research', 'space technology',
        'astrophysics', 'cosmology', 'astronautics', 'cosmonautics',
        'rocket science', 'rocketry', 'planetary science', 'aeronautics'
      );

    -- 4. Finance & Banking
    WHEN 'finance-banking' THEN
      RETURN clean_guess IN (
        'finance banking', 'finance and banking', 'finance', 'banking',
        'financial services', 'financial', 'bank', 'banks', 'fintech',
        'fin tech', 'investment banking', 'investment', 'investing',
        'financial management', 'economics', 'economy', 'wealth management',
        'commercial banking', 'personal finance', 'corporate finance',
        'money management'
      );

    -- 5. Education & Learning
    WHEN 'education-learning' THEN
      RETURN clean_guess IN (
        'education learning', 'education and learning', 'education', 'learning',
        'teaching', 'educational', 'edtech', 'ed tech', 'pedagogy',
        'academics', 'academic', 'schooling', 'e learning', 'elearning',
        'higher education', 'instruction'
      );

    -- 6. Sports
    WHEN 'sports' THEN
      RETURN clean_guess IN (
        'sports', 'sport', 'athletics', 'athletic', 'sporting', 'fitness',
        'physical education', 'sports science', 'sports and athletics',
        'athletics and sports', 'esports', 'e sports', 'physical training'
      );

    -- 7. Agriculture & Farming
    WHEN 'agriculture-farming' THEN
      RETURN clean_guess IN (
        'agriculture farming', 'agriculture and farming', 'agriculture',
        'farming', 'agritech', 'agri tech', 'agricultural', 'agribusiness',
        'agri business', 'agronomy', 'cultivation', 'farming and agriculture',
        'crop production', 'horticulture', 'agriculture science',
        'agricultural science', 'farming technology'
      );

    -- 8. Transportation & Travel
    WHEN 'transportation-travel' THEN
      RETURN clean_guess IN (
        'transportation travel', 'transportation and travel', 'transportation',
        'travel', 'transport', 'logistics', 'transit', 'public transit',
        'public transportation', 'public transport', 'mobility',
        'travel and tourism', 'travel and transportation', 'tourism',
        'freight', 'shipping', 'fleet management', 'traffic management',
        'aviation and transport'
      );

    -- 9. Crime Investigation & Forensics
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

    -- 10. Artificial Intelligence
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

GRANT EXECUTE ON FUNCTION public.check_domain_match TO anon, authenticated;
