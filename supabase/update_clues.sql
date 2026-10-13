-- ====================================================================
-- NEMESIS — UPDATE DOMAIN CLUES IN SUPABASE
-- ====================================================================
-- Run this query in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql/new
--
-- This script replaces all 150 clues across all 10 domains with the
-- more challenging clue set. Existing sessions and participant records
-- are preserved; any unlocked or revealed clue will instantly display
-- the updated text.

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
  (d_finance, 11, 'Digital instruction can move value between accounts without transporting a physical object.'),
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
  (d_edu, 15, 'This process develops knowledge, skills, understanding, and the ability to apply them.')
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
  (d_ai, 12, 'Image recognition, speech processing, prediction, and text generation are common applications.'),
  (d_ai, 13, 'Some systems create new material, while others estimate outcomes, identify patterns, plan actions, or classify information.'),
  (d_ai, 14, 'Developers integrate trained models into applications to automate tasks that involve language, perception, reasoning, or prediction.'),
  (d_ai, 15, 'It is the field of computing concerned with creating systems capable of performing tasks that typically require human-like intelligence.')
  ON CONFLICT (domain_id, clue_number) DO UPDATE SET clue_text = EXCLUDED.clue_text;
END $$;
