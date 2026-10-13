# NEMESIS // Sovereign Competition Platform

> **Nemesis** is a competitive, high-stakes gamified cybersecurity and domain-inference challenge platform built with a Doctor Doom / Latverian Citadel techno-arcane aesthetic.

> In Round 1 (**Find the Flag**), competitors are assigned an undisclosed hidden domain from 10 candidate fields. They must decipher 15 progressive clues, manage a strict 15-minute countdown, submit precise guesses, and navigate draconian terminal lockouts when incorrect answers are recorded. In Round 2 (**Tactical Syndicate**), competitors are formed into dual-agent syndicates and issued classified directives (*Operation Doom*).

---

## Table of Contents

1. [Project Overview & Lore](#1-project-overview--lore)
2. [Architecture & Technology Stack](#2-architecture--technology-stack)
3. [Game Rules & Mechanics (Round 1: Find the Flag)](#3-game-rules--mechanics-round-1-find-the-flag)
   - [Candidate Domains & Recognition](#candidate-domains--recognition)
   - [Progressive Clues & Scoring Tiers](#progressive-clues--scoring-tiers)
   - [15-Minute Live Countdown & Speed Multipliers](#15-minute-live-countdown--speed-multipliers)
   - [One Chance Per Clue & 15-Attempt Limit](#one-chance-per-clue--15-attempt-limit)
   - [Signal Lost Lockout & Dr. Doom Protocol](#signal-lost-lockout--dr-doom-protocol)
   - [Admin Pardon & Automatic Clue Advance](#admin-pardon--automatic-clue-advance)
4. [Round 2: Tactical Syndicate & Secret Directives](#4-round-2-tactical-syndicate--secret-directives)
   - [Team Formation (Pairs of 2)](#team-formation-pairs-of-2)
   - [Classified Directive: Operation Doom](#classified-directive-operation-doom)
   - [Stealth Privacy View](#stealth-privacy-view)
5. [Sovereign Admin Supervisory Console (`#/admin`)](#5-sovereign-admin-supervisory-console-admin)
   - [Supervisory Overview & Realtime Roster](#supervisory-overview--realtime-roster)
   - [Live Scoreboard & Leaderboard](#live-scoreboard--leaderboard)
   - [Syndicate Team Management](#syndicate-team-management)
   - [Deep Participant Inspection & Audit Trail](#deep-participant-inspection--audit-trail)
6. [Database Architecture & RPC Specification](#6-database-architecture--rpc-specification)
   - [Relational Schema Overview](#relational-schema-overview)
   - [RPC Stored Procedures](#rpc-stored-procedures)
   - [Security & Cryptography](#security--cryptography)
7. [Frontend Design System & Aesthetics](#7-frontend-design-system--aesthetics)
8. [Directory Structure](#8-directory-structure)
9. [Development & Deployment Runbook](#9-development--deployment-runbook)

---

## 1. Project Overview & Lore

Nemesis was designed for high-energy technical events, hackathons, and symposiums. The application immerses players into the command terminal of Victor Von Doom's Latverian Citadel:

- **Theme & Vibe:** Cyber-mystic brutalism, glowing neon emerald (`#10b981`), sovereign Latverian gold (`#f59e0b`), dark titanium palettes (`#020704`), CRT phosphor scanlines, high-voltage glitch noise, and rotating runic seals.
- **Doctor Doom Protocol:** Doom does not tolerate guesswork or frivolous submissions. Wrong guesses sever communications and trigger punitive terminal lockdowns. Participants must physically report to an administrative station or tournament volunteer to receive Doom's pardon.
- **Round 1 (Find the Flag):** Individual deductive trial. Players read progressive intelligence clues and attempt to identify their assigned hidden domain within 15 minutes.
- **Round 2 (Tactical Syndicate):** Collaborative stage where participants are paired into tactical duos, aggregate team scores, and receive encrypted transmissions concerning *Operation Doom* (a stealth player bounty system).

---

## 2. Architecture & Technology Stack

### Core Frontend Stack
- **Framework:** React 18 with TypeScript
- **Bundler & Tooling:** Vite 5
- **Styling:** Tailwind CSS + Vanilla CSS Custom Design Tokens (`src/index.css`)
- **Iconography:** Lucide React (`lucide-react`)
- **Typography:** Google Fonts (`Cinzel` for majestic headers, `Orbitron` for tactical callouts, `JetBrains Mono` for terminal readouts)
- **Visual FX:** Pure HTML5 Canvas 2D ambient particle engine (`ArcaneCanvas.tsx`) and vector SVG orbital rune rings (`DoomMask.tsx`)

### Backend & Infrastructure
- **BaaS Platform:** Supabase (PostgreSQL 15)
- **Database Engine:** PostgreSQL with `pgcrypto` extension for cryptographic salting and hashing
- **Security Paradigm:** Database-level Row Level Security (RLS) on all tables; all gameplay mutations are restricted to `SECURITY DEFINER` stored procedures (RPCs)
- **Real-Time Synchronization:** Supabase Realtime WebSocket channels (`postgres_changes`) combined with adaptive heartbeat polling fallbacks (2.5s–4s)
- **Client Library:** `@supabase/supabase-js` v2.57.4

### Routing & Session Management
- **Single Page Application Routing:** Native window hash routing (`#/admin` for the admin portal) combined with internal declarative state switching (`'landing' | 'entry' | 'dashboard' | 'completion' | 'admin-login' | 'admin'`).
- **Session Persistence:** Unique UUID session token stored in `localStorage` under `nemesis_session_token`. Re-entering with an existing Registered Roll Number (RRN) automatically restores the player's active state without penalty.

---

## 3. Game Rules & Mechanics (Round 1: Find the Flag)

### Candidate Domains & Recognition
Each competitor is assigned exactly one hidden domain from 10 predefined candidate fields. Domain assignment is performed dynamically upon registration using a **balanced random algorithm** (the system evaluates all 10 domains and assigns from the group having the lowest active sessions).

The 10 candidate domains are:
1. **Cybersecurity** (aliases accepted: `cybersecurity`, `cyber security`, `cyber`, `infosec`, `info sec`, `information security`, `network security`, `computer security`, `cyber defense`, `cyber defence`, `cyber safety`, `cyber attack`, `cyber security and defense`, `ethical hacking`, `hacking`, `it security`, `data security`, `penetration testing`, `pen testing`, `appsec`, `application security`, `cloud security`)
2. **Healthcare** (aliases accepted: `healthcare`, `health care`, `health`, `medicine`, `medical`, `medical science`, `clinical`, `hospital`, `hospitals`, `public health`, `healthcare and medicine`, `health and medicine`, `medical care`, `doctor`, `patient care`, `health sciences`, `health science`, `biomedical`, `pharmacy`, `pharmaceutical`, `pharma`, `medtech`, `health tech`, `healthtech`)
3. **Space Exploration** (aliases accepted: `space exploration`, `space`, `astronomy`, `space travel`, `aerospace`, `outer space`, `space science`, `space research`, `space technology`, `astrophysics`, `cosmology`, `astronautics`, `cosmonautics`, `rocket science`, `rocketry`, `planetary science`, `aeronautics`)
4. **Finance & Banking** (aliases accepted: `finance banking`, `finance and banking`, `finance`, `banking`, `financial services`, `financial`, `bank`, `banks`, `fintech`, `fin tech`, `investment banking`, `investment`, `investing`, `financial management`, `economics`, `economy`, `wealth management`, `commercial banking`, `personal finance`, `corporate finance`, `money management`)
5. **Education & Learning** (aliases accepted: `education learning`, `education and learning`, `education`, `learning`, `teaching`, `educational`, `edtech`, `ed tech`, `pedagogy`, `academics`, `academic`, `schooling`, `e learning`, `elearning`, `higher education`, `instruction`)
6. **Sports** (aliases accepted: `sports`, `sport`, `athletics`, `athletic`, `sporting`, `fitness`, `physical education`, `sports science`, `sports and athletics`, `athletics and sports`, `esports`, `e sports`, `physical training`)
7. **Agriculture & Farming** (aliases accepted: `agriculture farming`, `agriculture and farming`, `agriculture`, `farming`, `agritech`, `agri tech`, `agricultural`, `agribusiness`, `agri business`, `agronomy`, `cultivation`, `farming and agriculture`, `crop production`, `horticulture`, `agriculture science`, `agricultural science`, `farming technology`)
8. **Transportation & Travel** (aliases accepted: `transportation travel`, `transportation and travel`, `transportation`, `travel`, `transport`, `logistics`, `transit`, `public transit`, `public transportation`, `public transport`, `mobility`, `travel and tourism`, `travel and transportation`, `tourism`, `freight`, `shipping`, `fleet management`, `traffic management`, `aviation and transport`)
9. **Crime Investigation & Forensics** (aliases accepted: `crime investigation forensics`, `crime investigation and forensics`, `crime investigation`, `criminal investigation`, `crime`, `crimes`, `investigation`, `investigations`, `forensics`, `forensic`, `forensic science`, `criminology`, `criminalistics`, `detective`, `detectives`, `criminal`, `crime scene investigation`, `csi`, `digital forensics`, `police investigation`, `criminal justice`, `law enforcement`, `forensic investigation`, `crime and forensics`, `crime forensics`, `criminal forensics`, `crime detection`)
10. **Artificial Intelligence** (aliases accepted: `artificial intelligence`, `ai`, `a i`, `machine learning`, `ml`, `m l`, `deep learning`, `dl`, `d l`, `neural networks`, `neural network`, `generative ai`, `gen ai`, `genai`, `artificial general intelligence`, `agi`, `a g i`, `data science`, `natural language processing`, `nlp`, `computer vision`, `ai and ml`, `ai ml`)

Guesses are passed through the SQL `check_domain_match` function, which strips punctuation, collapses whitespace, normalizes casing, and validates against permitted aliases.

---

### Progressive Clues & Scoring Tiers
Every domain contains exactly **15 sequential clues** ordered from abstract, metaphorical, and ambiguous (Clue 1) to direct, explicit, and definitive (Clue 15).

Competitors can click **"Reveal Next Clue"** at any time without submitting a guess. Revealing clues incurs **zero penalty** and does not count as an attempt.

#### Base Points by Clue Level:
| Clues Unlocked | Base Score Awarded |
| :--- | :---: |
| **Clues 1 – 4** (Early Abstract Stage) | **15 Points** |
| **Clues 5 – 7** (Intermediate Context) | **12 Points** |
| **Clues 8 – 10** (Domain Signals) | **9 Points** |
| **Clues 11 – 13** (Specific Jargon & Entities) | **6 Points** |
| **Clues 14 – 15** (Direct Descriptive Flag) | **3 Points** |

---

### 15-Minute Live Countdown & Speed Multipliers
When the player clicks **"Begin Round 1"**, the database stamps `started_at = now()`. A strict **15-minute (900 seconds)** countdown begins immediately:

- **Live Countdown Display:** Header pill and active banner showing elapsed and remaining time (`MM:SS`).
- **Urgency Transitions:**
  - `> 5:00`: Neon emerald standard theme.
  - `5:00 – 1:00`: Amber glow warning.
  - `< 1:00`: Critical pulsing crimson alert with animated timer icon.
- **Automatic Timeout:** If 900 seconds elapse, both the client and server trigger auto-timeout (`timeout_round`). The session round status becomes `FAILED`, the correct domain is revealed, and the player is routed to the final performance dossier.

#### Speed Efficiency Multipliers (Applied to Base Score on Solve):
| Solve Time Elapsed | Speed Tier | Multiplier |
| :--- | :--- | :---: |
| **Under 2 Minutes (< 120s)** | **Lightning Bonus** | **1.30x** |
| **2 to 5 Minutes (120s – 300s)** | **Swift Bonus** | **1.15x** |
| **5 to 10 Minutes (300s – 600s)** | **Standard Speed** | **1.00x** |
| **10 to 15 Minutes (600s – 900s)** | **Overtime** | **0.90x** |

*Final Score Calculation:* `Score = ROUND(Base_Score * Speed_Multiplier)`.

---

### One Chance Per Clue & 15-Attempt Limit
To prevent brute-forcing, spamming, or reckless trial-and-error:
1. **Single Attempt Allocation:** A player gets **exactly one chance per clue** to guess the domain.
2. **UI Locking:** As soon as an attempt is registered on Clue *N*, the input box and submission button lock (`1 CHANCE USED FOR THIS CLUE`).
3. **Database Rejection:** `submit_guess` queries `guess_history`. If an entry exists for that `(session_id, clue_number)`, the database rejects the submission with `already_guessed_on_clue`.
4. **Max 15 Attempts:** Because there are 15 clues in total and each clue only allows one guess, a player has a **maximum of 15 attempts** across the entire round.

---

### Signal Lost Lockout & Dr. Doom Protocol
If a competitor submits an incorrect guess on any clue:
1. **Status Mutation:** The player's `player_status` changes to `'PENALTY_PENDING'`, and a strike is logged in `penalty_history`.
2. **Glitch Lock Screen:** The entire viewport is immediately intercepted by [`SignalLostOverlay.tsx`](file:///c:/Users/Musamuraaz/Desktop/project/src/components/SignalLostOverlay.tsx):
   - High-voltage horizontal noise streaks and CRT jitter.
   - Rotating typewriter monologue quotes from Victor Von Doom.
   - **Strike Counter:** `ATTEMPTS USED: [X] / 15 MAX`.
   - **Transmission Lockdown Box:** Redacted transmission banner (`ENCRYPTED BY DOOM`) displaying the active clue number and notice that unlocking advances the terminal to the next clue.
   - **Decrypted Archive Viewer:** Read-only accordion allowing the player to review clues unlocked prior to the penalty.
   - **Keyboard Trap:** Intercepts `Space`, `Enter`, and `Tab` events to prevent bypassing the modal.

---

### Admin Pardon & Automatic Clue Advance
To regain control of their terminal, the player must seek authorization from an event administrator:
1. **Administrator Action:** In the Admin Supervisory Console, the administrator locates the player (highlighted in pulsing amber with `PENALTY PENDING`) and clicks **`Unlock → Clue [N+1]`**.
2. **Server Execution (`resolve_penalty`):**
   - Updates `player_status` back to `'NORMAL'`.
   - Marks penalty records as `'RESOLVED'`.
   - **Automatically increments `current_clue = current_clue + 1`**!
   - (If the penalty occurred on Clue 15, all 15 attempts are exhausted; the procedure sets `round_status = 'FAILED'`, concluding the trial).
3. **Real-time Client Release:**
   - Realtime channel / polling detects `player_status = 'NORMAL'`.
   - The overlay triggers a 2-second **Pardon Screen** (*"DOOM HAS GRANTED YOUR PARDON. ADVANCING TO NEXT CLUE."*).
   - Once released, the player is on Clue *N+1* with the new clue text decrypted and ready for a fresh single guess.
   - A client-side safeguard in `Dashboard.tsx` verifies clue synchronization upon status restoration.

---

## 4. Round 2: Tactical Syndicate & Secret Directives

Once Round 1 completes, competitors transition into **Round 2 (Tactical Syndicate)**. The dossier banner is visible directly inside the main Dashboard and Completion screens.

```
+---------------------------------------------------------------------------------+
| TACTICAL SYNDICATE: SYNDICATE 04                                               |
| Player 1: Alex Mercer (RRN: CS202401) [15 pts] <You>                            |
| Player 2: Elena Rostova (RRN: CS202442) [12 pts]                               |
| COMBINED SYNDICATE SCORE: 27 PTS                                                |
+---------------------------------------------------------------------------------+
| [STEALTH DIRECTIVE]                                                            |
| CLASSIFIED DIRECTIVE // EYES ONLY [Hover/Tap to Decrypt]                       |
|   "Psst... You weren't supposed to see this. Doom is hunting down players      |
|    using paid AI plans (Claude Pro, Max). Reward: 8 points per confirmed target"|
+---------------------------------------------------------------------------------+
```

### Team Formation (Pairs of 2)
- Competitors are paired into two-person syndicates (`round2_teams`).
- Admin can manually pair competitors or create custom teams from the Admin Supervisory Console.
- Combined syndicate scores are calculated in real time (`player1.score + player2.score`).
- **Begin Round 2 Gatekeeper Control:** Round 2 teams and directives are **completely concealed from all players** until the Admin clicks **"Begin Round 2"** in the supervisory console (`#/admin`). Prior to activation, players' terminals render a sealed standby dossier and database RPCs refuse to disclose partner or team details.

### Classified Directive: Operation Doom
A covert side-quest mechanism managed by administrators through `round2_announcements`:
- **Decree Text:** Instructions from Doctor Doom encouraging players to identify and report peers using paid AI subscriptions (Claude Pro, Claude Max, ChatGPT Plus) for an 8-point bounty.
- **Admin Broadcast Toggle:** Administrators can reveal or conceal the broadcast live across all player terminals with a single switch.

### Stealth Privacy View
To prevent shoulder-surfing in crowded hackathon halls:
- When revealed, the secret directive defaults to a **Privacy-Concealed state** (black background, muted zinc borders, dimmed icons).
- The laptop owner can **hover with mouse** or **tap on touchscreens** to decrypt and read the text.
- Clicking or tapping pins/unpins the revealed state.

---

## 5. Sovereign Admin Supervisory Console (`#/admin`)

The administrative portal is accessible at `/#/admin` and guarded by a cryptographic password verified through `crypt(admin_pwd, password_hash)`.

### Supervisory Overview & Realtime Roster
- **Global KPI Counters:**
  - Total Challengers Registered
  - Active In Vault (Round in progress)
  - Completed / Flags Captured
  - Failed / Timed Out / Exhausted
  - Penalties Pending (Immediate attention indicator)
- **Live Search & Filter:** Filter by status (`ALL`, `ACTIVE`, `COMPLETED`, `FAILED`, `PENALTY_PENDING`) or search across names, RRNs, and assigned domains.
- **Live Action Roster Table:**
  - Participant Name & RRN
  - Assigned Domain
  - Round Status
  - Player Status (`NORMAL` vs `PENALTY PENDING`)
  - Clue Progress (`[N] / 15`)
  - Attempts Used (`[X] / 15`)
  - Score
  - Start Timestamp
  - **Contextual Action Buttons:**
    - `Unlock → Clue [N+1]`: One-click pardon that clears lockout and advances clue.
    - `Unlock & Conclude (15/15)`: Appears on final clue lockouts.
    - `Inspect`: Opens the deep audit dossier.
- **Export Utility:** One-click CSV export of participants and scoreboard data.
- **Auto-Refresh Toggle:** Periodic background refresh every 3 seconds with visual pulse indicator.

---

### Live Scoreboard & Leaderboard
- Ranked leaderboard sorted by **Final Score (Descending)** and **Elapsed Time (Ascending)**.
- **Podium Display:** Top 3 players highlighted with gold, emerald, and bronze crowns.
- **Speed Badges:** Visual tags indicating `LIGHTNING (1.30x)`, `SWIFT (1.15x)`, `STANDARD (1.00x)`, or `OVERTIME (0.90x)`.
- Accuracy metrics displaying total guesses and wrong guess count.

---

### Syndicate Team Management
- **Team Statistics:** Total players, formed teams, assigned players, and unassigned players.
- **Team Creation Controls:**
  - Auto-generate balanced teams of 2.
  - Manual creation with participant dropdown pickers.
  - Disband team button.
- **Broadcast Decree Editor:**
  - Real-time text editor for *Operation Doom* message payload.
  - Live broadcast toggle: **Reveal to All Terminals** / **Conceal Broadcast**.

---

### Deep Participant Inspection & Audit Trail
Clicking `Inspect` on any participant opens an administrative drawer displaying:
1. **Identity & Domain Dossier:** Participant name, RRN, session ID, assigned domain name, and domain slug.
2. **Penalty Resolution Banner:** Instant resolution button if currently locked.
3. **Clue Audit Breakdown:** All 15 clues for that domain, highlighting which clues have been unlocked by the player.
4. **Chronological Guess Log:** Exact submitted answers, correct/incorrect booleans, clue number submitted at, and millisecond timestamps.
5. **Penalty Incident History:** Timestamps of when penalties occurred, whether they are pending or resolved, and resolver ID.
6. **Administrative Audit Trail:** History of admin actions performed on the session.

---

## 6. Database Architecture & RPC Specification

### Relational Schema Overview

```
                 +-------------------+
                 |   participants    |
                 +-------------------+
                 | id (PK)           |
                 | name              |
                 | participant_id    | <---+ (Unique RRN)
                 | session_token     |
                 +-------------------+
                           |
                           | 1:1
                           v
+----------------+       +-------------------+       +--------------------+
|    domains     |       |   game_sessions   |       |    domain_clues    |
+----------------+       +-------------------+       +--------------------+
| id (PK)        | <----+| id (PK)           |       | id (PK)            |
| name           |       | participant_id    |       | domain_id (FK)     |<--+
| slug           |       | assigned_domain_id|       | clue_number (1-15) |   |
+----------------+       | round_status      |       | clue_text          |   |
                         | player_status     |       +--------------------+   |
                         | current_clue      |                                |
                         | wrong_guess_count |                                |
                         | score             |                                |
                         | started_at        |                                |
                         | completed_at      |                                |
                         +-------------------+                                |
                           |               |                                  |
            +--------------+               +---------------+                  |
            | 1:N                                          | 1:N              |
            v                                              v                  |
+----------------------+                     +-----------------------+        |
|    guess_history     |                     |    penalty_history    |        |
+----------------------+                     +-----------------------+        |
| id (PK)              |                     | id (PK)               |        |
| game_session_id (FK) |                     | game_session_id (FK)  |        |
| submitted_answer     |                     | penalty_type          |        |
| is_correct           |                     | status                |        |
| clue_number          |                     | created_at            |        |
| created_at           |                     | resolved_at           |        |
+----------------------+                     +-----------------------+        |
                                                                              |
+----------------------+                     +-----------------------+        |
|     round2_teams     |                     | round2_announcements  |        |
+----------------------+                     +-----------------------+        |
| id (PK)              |                     | id (PK = doom_bounty) |        |
| team_number          |                     | message               |        |
| team_name            |                     | is_revealed           |        |
| player1_id (FK)      |                     | revealed_at           |        |
| player2_id (FK)      |                     +-----------------------+        |
+----------------------+                                                      |
                                                                              |
+----------------------+                     +-----------------------+        |
|     admin_config     |                     |    admin_audit_log    |        |
+----------------------+                     +-----------------------+        |
| id (PK)              |                     | id (PK)               |        |
| password_hash        |                     | admin_id              |        |
+----------------------+                     | game_session_id (FK)  |        |
                                             | action                |        |
                                             | created_at            |        |
                                             +-----------------------+        |
```

---

### RPC Stored Procedures

All database procedures reside in `public` schema and run with `SECURITY DEFINER SET search_path = public, extensions`:

| Procedure | Parameters | Description |
| :--- | :--- | :--- |
| `register_or_resume_participant` | `p_name text, p_participant_id text` | Idempotent registration. Finds or creates participant, performs balanced domain assignment, returns session token. |
| `begin_round` | `p_session_token uuid` | Starts the round, stamps `started_at = now()`, reveals Clue 1, sets `round_status = 'ACTIVE'`. |
| `reveal_next_clue` | `p_session_token uuid` | Unlocks Clue *N+1* (up to 15). Checks 15-minute expiration. |
| `submit_guess` | `p_session_token uuid, p_guess text` | Validates guess, enforces 1 guess per clue, scores with speed bonus if correct, locks terminal (`PENALTY_PENDING`) if incorrect. |
| `timeout_round` | `p_session_token uuid` | Sets `round_status = 'FAILED'`, reveals assigned domain name upon 15:00 expiration. |
| `get_game_state` | `p_session_token uuid` | Returns full session state, unlocked clues (`clue_number <= current_clue`), guess history, and team info. |
| `resolve_penalty` | `admin_pwd text, p_session_id uuid` | Authenticates admin cipher, clears lockout to `NORMAL`, and **auto-advances clue to `current_clue + 1`** (or sets `FAILED` if on Clue 15). |
| `get_admin_dashboard_data` | `admin_pwd text` | Authenticates admin, returns global stats and participant rows with scoring and clue progress. |
| `get_admin_participant_details` | `admin_pwd text, p_session_id uuid` | Returns detailed participant dossier including all clues, guesses, penalties, and audit logs. |
| `get_round2_teams_data` | `admin_pwd text` | Returns formed syndicates, unassigned players, and broadcast announcement state. |
| `create_round2_team` | `admin_pwd text, p_p1 uuid, p_p2 uuid, p_name text` | Forms a two-player syndicate in `round2_teams`. |
| `disband_round2_team` | `admin_pwd text, p_team_id uuid` | Disbands an existing syndicate, returning players to the unassigned pool. |
| `reveal_round2_broadcast_message` | `admin_pwd text, p_reveal bool, p_message text` | Updates and reveals/conceals *Operation Doom* broadcast decree live. |
| `get_round2_broadcast_message` | *(none)* | Public read procedure returning broadcast status and payload for client polling. |
| `get_player_team_info` | `p_session_token uuid` | Returns assigned syndicate info, teammate name, scores, and broadcast payload for a player. |
| `admin_adjust_score` | `admin_pwd text, p_target_type text, p_target_id uuid, p_delta integer, p_reason text` | Alters score for a Round 2 Team (`score_adjustment`) or unassigned solo player (`game_sessions.score`), strictly floored at 0. |
| `admin_transfer_bounty` | `admin_pwd text, p_violator_type text, p_violator_id uuid, p_reporter_type text, p_reporter_id uuid, p_points integer, p_reason text` | Atomically transfers bounty points (-8 from Violator, +8 to Reporter) with audit logging and non-negative score flooring. |

---

### Security & Cryptography
- **No Direct Table Exposure:** Anonymous and authenticated users are denied direct `INSERT`, `UPDATE`, or `DELETE` access on tables via RLS policies (`USING (false)`).
- **Cipher Verification:** The administrator password hash is generated and verified using `extensions.crypt(admin_pwd, password_hash)` from `pgcrypto`. Plaintext passwords are never stored.
- **Scoped Search Path:** All RPC functions explicitly define `SET search_path = public, extensions` to protect against search path hijacking vulnerabilities.

---

## 7. Frontend Design System & Aesthetics

### Visual Hierarchy & Palette
- **Deep Slate Canvas:** `#020704` (Void background)
- **Latverian Emerald:** `#10b981` (Accents, active states, correct guesses, primary buttons)
- **Sovereign Gold:** `#f59e0b` (Headers, score counters, admin highlights, warnings)
- **High-Alert Red:** `#ef4444` (Penalty lockouts, critical timers, wrong strikes)
- **Surveillance Zinc:** `#18181b` / `#27272a` (Panels, borders, subtle text)

### Reusable UI Components
- **`DoomMask.tsx`:** Custom SVG implementation of Doctor Doom's titanium faceplate with concentric counter-rotating rune rings and volumetric radial glows.
- **`ArcaneCanvas.tsx`:** HTML5 2D Canvas generating slow-drifting emerald embers and gold celestial motes that automatically resize and pause on unmount.
- **`SignalLostOverlay.tsx`:** Full-screen corrupted signal modal utilizing CSS scanlines, screen jitter animations, typewriter monologue quotes, and keyboard focus trapping.
- **`Round2TeamCard.tsx`:** Tactical syndicate dossier card featuring score aggregation, teammate badges, and shoulder-surf-proof stealth directive decryption.
- **`directiveRenderer.tsx`:** Custom markdown parser transforming the raw *Operation Doom* text into styled tactical blocks without third-party markdown dependencies.

### UI Redesign "Emerald Sovereign" (2026-10, branch `ui-redesign`)
The whole UI was redesigned **without touching game logic** (`src/lib`, `src/hooks`, `App.tsx`,
`supabase/` are unchanged; screens only changed markup/styles). Read `UI_PLAN.md` (plan + progress log)
before changing the UI, and keep the rules: **UI only, never change handlers, state, API calls or conditions**,
and **never change or add visible text**: every screen shows exactly the original wording (the owner asked
for this; extra sections and taglines were removed again in V2). Even colour-only edits in `src/lib` are off
limits. Before saying a behaviour bug is "in the UI", diff the logic against `main` (`git diff main -- src/lib
src/hooks src/App.tsx`) and reproduce it with the friend's original side by side.
- **Wrong guess → lock screen:** the client only shows the lock screen when the server returns
  `player_status = 'PENALTY_PENDING'` (set by `submit_guess`, see `supabase/migrations/20261011085000_*`). If
  a wrong guess shows "Screen locked. Await admin unlock…" but no lock screen and jumps to the next clue, the
  **live database's `submit_guess` is not locking** (the client's auto-advance runs for NORMAL players): check
  it in the Supabase SQL editor, not the UI. (2026-10-12: the deployed site is byte-identical to a build of
  `main` and locks correctly; the reported "bug" came from the scratch fake-data preview, whose mock
  never locked. Test real behaviour with `npm run dev` → http://localhost:5173, started **inside the
  Nemesis folder**: Tailwind finds its config from the folder it is started in, and started elsewhere the
  page has no styles, so the lock screen sits at the bottom of the page instead of covering it.)
- **Fake-data preview:** Claude's scratch preview (localhost:5199) shows a red "FAKE PREVIEW" label. Never
  judge game behaviour there; it is only for looks.
- **Palette:** green is the only accent; amber = warning, red = penalty. Tokens in `tailwind.config.js`
  (`doom-*`, and the default `emerald`/`cyan`/`gray`/`zinc` palettes are remapped there).
- **3D Doom (full model):** "Doctor Doom's Mask" by Nicolas_Laube (Sketchfab, **CC BY 4.0** — keep the
  credit line in the Landing footer): mask, head, green hood/cloak, copper clasps. The owner chose the full
  model. `public/models/doom-full.glb` (4.1 MB, textures as JPEG); see `DOOM_MODEL.md`. While it loads (and on
  devices without 3D) a still image of the same model shows (`DoomPoster.tsx`, a light scan sweeps over it);
  small icons use `DoomFace.tsx`. The old cartoon SVG `DoomMask` is no longer shown anywhere (owner: "childish").
- **One 3D scene and one background for the whole app** (speed): `doom3d/stage.ts` builds the 3D scene once
  and moves its canvas into whichever `Doom3D` box is on screen (the newest claim wins, e.g. the lock screen
  over the game); `backdrop/Backdrop.tsx` does the same for the dot background (`<Backdrop />` behind the
  page, `<BackdropSlot />` inside the lock screen as a red "corrupted signal"). Building them per page froze
  the Landing → Entry change for ~0.5 s (frames of 180/97/188 ms); now the slowest frame is ~14 ms. Never
  give a page its own WebGL canvas again.
- **Lock screen layout:** its root has a transform/filter animation (`doom-screen-jitter`), so its `fixed`
  children are positioned against the root, not the window. The root must not scroll: the content scrolls in
  the inner `overflow-y-auto` box, so the background layers stay full-screen.
- **No copy / paste for players:** `NoCopy.tsx` is mounted on every player screen (not admin) so clues can't
  be copied into a chatbot or answers pasted in. Add `<NoCopy />` to any new player screen.
- **Load test (2026-10-12, real database, owner-approved):** 60 fake players (LOADTEST01..60) registered,
  began, revealed a clue, guessed wrong (all 60 locked) and polled like real screens for 2 minutes: 4,429
  requests at 36/s, **0 errors**, median 45 ms, p95 under 90 ms, slowest 382 ms. Note: `get_game_state` does
  not return the session `id`, so the lock screen's realtime channel never opens; unlocks arrive through the
  2.5 s polling (friend's logic, unchanged). Delete test players with
  `delete from public.participants where participant_id like 'LOADTEST%';`
- **Admin password:** stored only as a bcrypt hash in `admin_config`. The plain text was removed from
  `supabase/*.sql` (placeholder `PUT-THE-NEW-PASSWORD-HERE`); the owner chose to keep the current password,
  which is still visible in the public repo's git history (first commit). Never write it into the repo. `doom3d/`: `maskModel.ts` (centre, scale, find the eyes),
  `DoomScene.tsx` (dark studio, eye glow green / red when judging, rises in, floats, turns to the cursor),
  `Doom3D.tsx` (SVG fallback while loading or if 3D fails, lazy loading, pauses off screen), `DoomHero.tsx`
  (Landing; red eyes while the Rules window is open). On the game screen it sits above the Round 2 card
  (laptops) / at the top (phones). Rejected by the owner: the code-built Doom figure, the scroll story, and
  a code-built mask ("childish").
  Gotcha: `PMREMGenerator.fromScene` leaves the studio's black as the clear colour — reset it to
  transparent, and keep the glow sprite inside the canvas, or a dark box shows round the mask.
- **Background:** `backdrop/Backdrop.tsx` is a port of the AI&DS Club site's moving dot background
  (`flow-background.tsx` there: two WebGL passes, flowing noise, cursor glow), dark graphite with a hint of
  green. `stage` on the Landing (clear middle for the mask), `calm` on the game screen and admin. It is a
  fixed canvas at `z-index: -1`, so **`body` must stay transparent** (the page colour is on `html`).
  Rejected: the earlier busy 3D background (smoke, sigil rings, node network, embers, hex floor).
- **Motion:** `motion/Reveal.tsx` (sections fade up on scroll), loading screen in `index.html` (only on slow loads).
- **Speed:** home and game screen run at 144 fps (screen max) on Intel UHD integrated graphics.
  No `backdrop-filter: blur` anywhere (very slow over moving WebGL); if a bar needs to hide what
  scrolls under it, give it a solid background. Tailwind 3 only has opacity steps of 5 (`/90`, `/95`):
  `bg-x/92` silently produces nothing.
- **Gotcha:** don't put `overflow-x: hidden` on html/body: it breaks `position: sticky` (use `clip`).

---

## 8. Directory Structure

```
c:\Users\Musamuraaz\Desktop\project\
├── .bolt/
│   └── prompt                     # Project requirements & initial guidelines
├── .env                           # Supabase URL & Anon Key configuration
├── .env.example                   # Environment variable template
├── index.html                     # HTML5 entry with fonts and meta tags
├── package.json                   # Dependencies & build scripts
├── vite.config.ts                 # Vite bundler configuration with @/ path alias
├── tailwind.config.js             # Tailwind CSS configuration
├── tsconfig.json                  # TypeScript root configuration
├── src/
│   ├── main.tsx                   # React root hydration
│   ├── App.tsx                    # Main router & top-level view coordinator
│   ├── index.css                  # Custom styling, scanlines, animations, tokens
│   ├── components/
│   │   ├── Landing.tsx            # Hero landing screen & briefing monologue
│   │   ├── Entry.tsx              # Registration & RRN entry modal
│   │   ├── Dashboard.tsx          # Main active game arena (clues, guess, timer)
│   │   ├── Completion.tsx         # Victory/defeat final performance dossier
│   │   ├── SignalLostOverlay.tsx  # Fullscreen glitch lock screen (Doom protocol)
│   │   ├── Round2TeamCard.tsx     # Syndicate dossier & stealth directive viewer
│   │   ├── AdminLogin.tsx         # Sovereign cipher login screen
│   │   ├── AdminDashboard.tsx     # Full administrative command console
│   │   ├── DoomMask.tsx           # Vector Doctor Doom mask with runic rings
│   │   └── ArcaneCanvas.tsx       # HTML5 canvas ambient particle engine
│   ├── hooks/
│   │   └── useLockStatus.ts       # Realtime lock detection, polling, and release phases
│   └── lib/
│       ├── api.ts                 # Typed RPC API client wrapper functions
│       ├── directiveRenderer.tsx  # Custom parser for classified broadcasts
│       ├── sound.ts               # Interface audio system
│       ├── supabase.ts            # Supabase client singleton initialization
│       └── types.ts               # Complete TypeScript data model interfaces
└── supabase/
    ├── setup_complete_database.sql # Master consolidated database initialization script
    ├── set_admin_password.sql     # Admin password hash generation script
    ├── update_secret_message.sql  # Secret broadcast update script
    ├── update_clues.sql           # Clues replacement script for Supabase SQL Editor
    └── migrations/                # Chronological SQL migrations
        ├── 20261004094747_create_dr_doom_tables.sql
        ├── 20261004094827_create_dr_doom_functions.sql
        ├── 20261004095238_lockdown_participants_table.sql
        ├── 20261004095338_fix_crypt_search_path.sql
        ├── 20261010090000_nemesis_round1_find_the_flag.sql
        ├── 20261010110500_add_time_scoring_and_timeout.sql
        ├── 20261010190000_add_round2_teams.sql
        ├── 20261011085000_one_guess_per_clue_auto_advance.sql
        ├── 20261012211500_normalize_and_expand_domain_guesses.sql
        ├── 20261013002000_add_begin_round2_control.sql
        ├── 20261013070000_add_round2_bounty_and_score_adjustments.sql
        └── 20261013184500_update_domain_clues_more_difficult.sql
```

---

## 9. Development & Deployment Runbook

### Prerequisites
- Node.js 18+ / npm 9+
- A Supabase Project instance

### Environment Setup
Create a `.env` file in the project root:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Database Initialization
1. Open your **Supabase Dashboard** -> **SQL Editor**.
2. Run `supabase/setup_complete_database.sql` to initialize all tables, domains, clues, security policies, and procedures.
3. Run `supabase/migrations/20261010190000_add_round2_teams.sql` to initialize Round 2 teams and announcements.
4. Run `supabase/migrations/20261011085000_one_guess_per_clue_auto_advance.sql` to apply single-guess and auto-advance rules.
5. Run `supabase/migrations/20261012211500_normalize_and_expand_domain_guesses.sql` to update `check_domain_match` with all normalized domain guess words and related terms.
6. Run `supabase/migrations/20261013002000_add_begin_round2_control.sql` to apply the 'Begin Round 2' admin gatekeeper control.
7. Run `supabase/update_clues.sql` (or `supabase/migrations/20261013184500_update_domain_clues_more_difficult.sql`) to apply the challenging 150-clue intelligence set.
8. Set your administrative password using `supabase/set_admin_password.sql` (default password configured: `admin123`).

### Local Development
```bash
# Install dependencies
npm install

# Start Vite development server
npm run dev
```

### Production Build & Verification
```bash
# Type check and generate production bundle
npm run build

# Preview production build locally
npm run preview
```

### Accessing the Administrative Portal
- Open the application and append `#/admin` to the URL: `http://localhost:5173/#/admin`.
- Enter the supervisory cipher (default: `admin123`).
- From the console, monitor all active terminals, unlock penalized competitors, examine detailed guess histories, form syndicates, and broadcast live directives.
