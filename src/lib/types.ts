export type RoundStatus = 'NOT_STARTED' | 'ACTIVE' | 'COMPLETED' | 'FAILED';
export type PlayerStatus = 'NORMAL' | 'PENALTY_PENDING';

export interface ClueItem {
  clue_number: number;
  clue_text: string;
}

export interface GuessRecord {
  submitted_answer: string;
  is_correct: boolean;
  clue_number: number;
  created_at: string;
}

export interface RegisterResult {
  id: string;
  session_token: string;
  name: string;
  participant_id: string;
  round_status: RoundStatus;
  player_status: PlayerStatus;
  current_clue: number;
  wrong_guess_count: number;
  score: number;
  started_at: string | null;
  completed_at: string | null;
  resumed: boolean;
  error?: string;
}

export interface PlayerTeamMember {
  name: string;
  participant_id: string;
  score: number;
  is_you?: boolean;
  role?: string;
}

export interface PlayerTeamInfo {
  is_round2_active?: boolean;
  is_assigned: boolean;
  team_id?: string;
  team_number?: number;
  team_name?: string;
  created_at?: string;
  total_score?: number;
  is_player1?: boolean;
  player1?: PlayerTeamMember;
  player2?: PlayerTeamMember;
  you?: PlayerTeamMember;
  teammate?: PlayerTeamMember;
  participant_name?: string;
  participant_id?: string;
  broadcast_revealed?: boolean;
  broadcast_message?: string | null;
  error?: string;
}

export interface GameSessionState {
  id?: string;
  participant_name: string;
  participant_id: string;
  round_status: RoundStatus;
  player_status: PlayerStatus;
  current_clue: number;
  wrong_guess_count: number;
  score: number;
  started_at: string | null;
  completed_at: string | null;
  time_taken_seconds?: number;
  timed_out?: boolean;
  assigned_domain_name?: string;
  unlocked_clues: ClueItem[];
  guesses: GuessRecord[];
  team?: PlayerTeamInfo | null;
  error?: string;
}

export interface BeginRoundResult {
  round_status: RoundStatus;
  player_status: PlayerStatus;
  current_clue: number;
  wrong_guess_count: number;
  score: number;
  clue_number: number;
  clue_text: string;
  error?: string;
}

export interface RevealNextClueResult {
  current_clue: number;
  clue_text: string;
  timed_out?: boolean;
  error?: string;
}

export interface SubmitGuessResult {
  correct: boolean;
  exhausted?: boolean;
  timed_out?: boolean;
  score?: number;
  base_score?: number;
  time_multiplier?: number;
  speed_tier?: string;
  time_taken_seconds?: number;
  round_status: RoundStatus;
  player_status: PlayerStatus;
  current_clue?: number;
  wrong_guess_count: number;
  domain_name?: string;
  error?: string;
}

export interface TimeoutRoundResult {
  timed_out?: boolean;
  round_status?: RoundStatus;
  domain_name?: string;
  error?: string;
}

// ===== Admin Interfaces =====

export interface AdminStats {
  total_players: number;
  active_players: number;
  completed_players: number;
  failed_players: number;
  penalty_pending_count: number;
}

export interface AdminParticipantRow {
  session_id: string;
  participant_name: string;
  participant_id: string;
  assigned_domain_name: string;
  round_status: RoundStatus;
  player_status: PlayerStatus;
  current_clue: number;
  wrong_guess_count: number;
  score: number;
  started_at: string | null;
  completed_at: string | null;
  time_taken_seconds?: number | null;
}

export interface AdminDashboardData {
  stats: AdminStats;
  participants: AdminParticipantRow[];
  error?: string;
}

export interface DetailedClueItem {
  clue_number: number;
  clue_text: string;
  unlocked: boolean;
}

export interface PenaltyRecord {
  id: string;
  penalty_type: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface AuditLogRecord {
  admin_id: string;
  action: string;
  created_at: string;
}

export interface AdminParticipantDetail {
  session_id: string;
  participant_name: string;
  participant_id: string;
  assigned_domain_name: string;
  assigned_domain_slug: string;
  round_status: RoundStatus;
  player_status: PlayerStatus;
  current_clue: number;
  wrong_guess_count: number;
  score: number;
  started_at: string | null;
  completed_at: string | null;
  clues: DetailedClueItem[];
  guesses: GuessRecord[];
  penalties: PenaltyRecord[];
  audit_logs: AuditLogRecord[];
  error?: string;
}

export interface ResolvePenaltyResult {
  success?: boolean;
  session_id?: string;
  player_status?: PlayerStatus;
  current_clue?: number;
  round_status?: RoundStatus;
  error?: string;
}

export interface Round2PlayerSummary {
  id: string;
  name: string;
  participant_id: string;
  round1_score: number;
  round1_status: string;
}

export interface Round2TeamItem {
  id: string;
  team_number: number;
  team_name: string;
  created_at: string;
  player1: Round2PlayerSummary;
  player2: Round2PlayerSummary;
  combined_round1_score: number;
  score_adjustment?: number;
}

export type ScoreTargetType = 'TEAM' | 'INDIVIDUAL';

export interface AdminAdjustScoreResult {
  success?: boolean;
  target_type?: ScoreTargetType;
  team_id?: string;
  team_name?: string;
  participant_id?: string;
  participant_name?: string;
  previous_score?: number;
  new_score?: number;
  delta?: number;
  score_adjustment?: number;
  error?: string;
  message?: string;
}

export interface AdminTransferBountyResult {
  success?: boolean;
  points_transferred?: number;
  violator?: {
    type: ScoreTargetType;
    id: string;
    previous_score: number;
    new_score: number;
    deducted: number;
  };
  reporter?: {
    type: ScoreTargetType;
    id: string;
    previous_score: number;
    new_score: number;
    awarded: number;
  };
  error?: string;
  message?: string;
}

export interface Round2TeamsData {
  is_round2_active?: boolean;
  round2_started_at?: string | null;
  teams: Round2TeamItem[];
  unassigned_players: Round2PlayerSummary[];
  stats: {
    total_players: number;
    formed_teams_count: number;
    assigned_players_count: number;
    unassigned_players_count: number;
  };
  broadcast_revealed?: boolean;
  broadcast_message?: string;
  error?: string;
}

export interface CreateTeamResult {
  success?: boolean;
  team_id?: string;
  team_name?: string;
  team_number?: number;
  error?: string;
}

export interface DisbandTeamResult {
  success?: boolean;
  error?: string;
}

export interface Round2BroadcastMessage {
  is_revealed: boolean;
  message: string;
  revealed_at?: string | null;
  error?: string;
}

export interface RevealBroadcastResult {
  success?: boolean;
  is_revealed?: boolean;
  message?: string;
  error?: string;
}

export const DEFAULT_SECRET_DIRECTIVE = `### ☠️ CLASSIFIED DIRECTIVE: OPERATION DOOM

**Psst… You weren't supposed to see this.**

Doom is hunting down players who have an unfair advantage. Your mission, should you choose to accept it, is to identify participants using **paid AI plans** while others rely on free-tier tools.

Targets include Claude Pro, Claude Max, and other premium AI subscriptions that provide access to enhanced capabilities or usage limits.

**Your reward:** 8 points from every confirmed target.

**Your objective:** Find them. Report them. Help Doom restore balance.

*Trust no one. Question everything. Doom is watching.*

**This message is classified. Proceed discreetly.**`;

