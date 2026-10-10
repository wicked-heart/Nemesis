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

export interface GameSessionState {
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
  error?: string;
}
