import { supabase } from './supabase';
import type {
  RegisterResult,
  GameSessionState,
  BeginRoundResult,
  RevealNextClueResult,
  SubmitGuessResult,
  TimeoutRoundResult,
  AdminDashboardData,
  AdminParticipantDetail,
  ResolvePenaltyResult,
  Round2TeamsData,
  CreateTeamResult,
  DisbandTeamResult,
  PlayerTeamInfo,
  Round2BroadcastMessage,
  RevealBroadcastResult,
  AdminAdjustScoreResult,
  AdminTransferBountyResult,
  ScoreTargetType,
} from './types';
import { DEFAULT_SECRET_DIRECTIVE } from './types';

const STORAGE_KEY = 'nemesis_session_token';

export function getSessionToken(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setSessionToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearSessionToken(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ===== Participant API =====

export async function registerOrResumeParticipant(name: string, participantId: string): Promise<RegisterResult> {
  const { data, error } = await supabase.rpc('register_or_resume_participant', {
    p_name: name.trim(),
    p_participant_id: participantId.trim(),
  });
  if (error) throw new Error(error.message);
  const result = data as RegisterResult;
  if (result.session_token) {
    setSessionToken(result.session_token);
  }
  return result;
}

function normalizeBroadcastMessage(msg?: string | null): string {
  if (!msg || msg.includes('help doom catch cheaters') || !msg.includes('OPERATION DOOM')) {
    return DEFAULT_SECRET_DIRECTIVE;
  }
  return msg.replace(/8 points for every confirmed target/gi, '8 points from every confirmed target');
}

export async function getGameState(): Promise<GameSessionState | null> {
  const token = getSessionToken();
  if (!token) return null;

  const { data, error } = await supabase.rpc('get_game_state', {
    p_session_token: token,
  });
  if (error) throw new Error(error.message);
  if (!data || (data as { error?: string }).error) return null;
  const state = data as GameSessionState;

  try {
    const broadcast = await getBroadcastMessage();
    if (broadcast) {
      if (!state.team) {
        state.team = {
          is_assigned: false,
          broadcast_revealed: broadcast.is_revealed,
          broadcast_message: broadcast.message,
        };
      } else {
        state.team.broadcast_revealed = broadcast.is_revealed;
        state.team.broadcast_message = broadcast.message;
      }
    }
  } catch {
    // Ignore sync error
  }

  if (state.team?.broadcast_message !== undefined) {
    state.team.broadcast_message = normalizeBroadcastMessage(state.team.broadcast_message);
  }
  return state;
}

export async function getPlayerTeamInfo(): Promise<PlayerTeamInfo | null> {
  const token = getSessionToken();
  if (!token) return null;

  const { data, error } = await supabase.rpc('get_player_team_info', {
    p_session_token: token,
  });
  if (error) throw new Error(error.message);
  if (!data || (data as { error?: string }).error) return null;
  const team = data as PlayerTeamInfo;

  try {
    const broadcast = await getBroadcastMessage();
    if (broadcast) {
      team.broadcast_revealed = broadcast.is_revealed;
      team.broadcast_message = broadcast.message;
    }
  } catch {
    // Ignore sync error
  }

  if (team.broadcast_message !== undefined) {
    team.broadcast_message = normalizeBroadcastMessage(team.broadcast_message);
  }
  return team;
}

export async function beginRound(): Promise<BeginRoundResult> {
  const token = getSessionToken();
  if (!token) throw new Error('No active session token');

  const { data, error } = await supabase.rpc('begin_round', {
    p_session_token: token,
  });
  if (error) throw new Error(error.message);
  const res = data as BeginRoundResult;
  if (res.error) throw new Error(res.error);
  return res;
}

export async function revealNextClue(): Promise<RevealNextClueResult> {
  const token = getSessionToken();
  if (!token) throw new Error('No active session token');

  const { data, error } = await supabase.rpc('reveal_next_clue', {
    p_session_token: token,
  });
  if (error) throw new Error(error.message);
  return data as RevealNextClueResult;
}

export async function submitGuess(guess: string): Promise<SubmitGuessResult> {
  const token = getSessionToken();
  if (!token) throw new Error('No active session token');

  const { data, error } = await supabase.rpc('submit_guess', {
    p_session_token: token,
    p_guess: guess.trim(),
  });
  if (error) throw new Error(error.message);
  return data as SubmitGuessResult;
}

export async function timeoutRound(): Promise<TimeoutRoundResult> {
  const token = getSessionToken();
  if (!token) throw new Error('No active session token');

  const { data, error } = await supabase.rpc('timeout_round', {
    p_session_token: token,
  });
  if (error) throw new Error(error.message);
  return data as TimeoutRoundResult;
}

// ===== Admin API =====

export async function getAdminDashboard(password: string): Promise<AdminDashboardData> {
  const { data, error } = await supabase.rpc('get_admin_dashboard', {
    admin_pwd: password,
  });
  if (error) throw new Error(error.message);
  const res = data as AdminDashboardData;
  if (res.error) throw new Error(res.error);
  return res;
}

export async function getAdminParticipantDetails(password: string, sessionId: string): Promise<AdminParticipantDetail> {
  const { data, error } = await supabase.rpc('get_admin_participant_details', {
    admin_pwd: password,
    p_session_id: sessionId,
  });
  if (error) throw new Error(error.message);
  const res = data as AdminParticipantDetail;
  if (res.error) throw new Error(res.error);
  return res;
}

export async function resolvePenalty(password: string, sessionId: string): Promise<ResolvePenaltyResult> {
  const { data, error } = await supabase.rpc('resolve_penalty', {
    admin_pwd: password,
    p_session_id: sessionId,
  });
  if (error) throw new Error(error.message);
  const res = data as ResolvePenaltyResult;
  if (res.error) throw new Error(res.error);
  return res;
}

// ===== Round 2 Team Formation API =====

export async function getRound2Teams(password: string): Promise<Round2TeamsData> {
  const { data, error } = await supabase.rpc('get_round2_teams_data', {
    admin_pwd: password,
  });
  if (error) throw new Error(error.message);
  const teamsData = data as Round2TeamsData;

  try {
    const broadcast = await getBroadcastMessage();
    if (broadcast) {
      teamsData.broadcast_revealed = broadcast.is_revealed;
      teamsData.broadcast_message = broadcast.message;
    }
  } catch (bErr) {
    console.error('Error fetching broadcast in getRound2Teams:', bErr);
  }

  if (teamsData?.broadcast_message !== undefined) {
    teamsData.broadcast_message = normalizeBroadcastMessage(teamsData.broadcast_message);
  }
  return teamsData;
}

export async function createRound2Team(
  password: string,
  player1Id: string,
  player2Id: string,
  teamName?: string
): Promise<CreateTeamResult> {
  const { data, error } = await supabase.rpc('create_round2_team', {
    admin_pwd: password,
    p_player1_id: player1Id,
    p_player2_id: player2Id,
    p_team_name: teamName?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return data as CreateTeamResult;
}

export async function disbandRound2Team(password: string, teamId: string): Promise<DisbandTeamResult> {
  const { data, error } = await supabase.rpc('disband_round2_team', {
    admin_pwd: password,
    p_team_id: teamId,
  });
  if (error) throw new Error(error.message);
  return data as DisbandTeamResult;
}

export async function revealBroadcastMessage(
  password: string,
  reveal: boolean = true
): Promise<RevealBroadcastResult> {
  const { data, error } = await supabase.rpc('reveal_round2_broadcast_message', {
    admin_pwd: password,
    p_reveal: reveal,
  });
  if (error) throw new Error(error.message);
  const result = data as RevealBroadcastResult;
  if (result?.message !== undefined) {
    result.message = normalizeBroadcastMessage(result.message);
  }
  return result;
}

export async function getBroadcastMessage(): Promise<Round2BroadcastMessage> {
  const { data, error } = await supabase.rpc('get_round2_broadcast_message');
  if (error) throw new Error(error.message);
  const result = data as Round2BroadcastMessage;
  if (result?.message !== undefined) {
    result.message = normalizeBroadcastMessage(result.message);
  }
  return result;
}

export async function setRound2Active(
  password: string,
  active: boolean = true
): Promise<{ success?: boolean; is_round2_active?: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('set_round2_active', {
    admin_pwd: password,
    p_active: active,
  });
  if (error) throw new Error(error.message);
  return data as { success?: boolean; is_round2_active?: boolean; error?: string };
}

export async function getRound2Status(): Promise<{ is_round2_active: boolean; started_at?: string | null }> {
  const { data, error } = await supabase.rpc('get_round2_status');
  if (error) throw new Error(error.message);
  return data as { is_round2_active: boolean; started_at?: string | null };
}

export async function adminAdjustScore(
  password: string,
  targetType: ScoreTargetType,
  targetId: string,
  delta: number,
  reason?: string
): Promise<AdminAdjustScoreResult> {
  const { data, error } = await supabase.rpc('admin_adjust_score', {
    admin_pwd: password,
    p_target_type: targetType,
    p_target_id: targetId,
    p_delta: delta,
    p_reason: reason || null,
  });
  if (error) throw new Error(error.message);
  return data as AdminAdjustScoreResult;
}

export async function adminTransferBounty(
  password: string,
  violatorType: ScoreTargetType,
  violatorId: string,
  reporterType: ScoreTargetType,
  reporterId: string,
  points: number = 8,
  reason?: string
): Promise<AdminTransferBountyResult> {
  const { data, error } = await supabase.rpc('admin_transfer_bounty', {
    admin_pwd: password,
    p_violator_type: violatorType,
    p_violator_id: violatorId,
    p_reporter_type: reporterType,
    p_reporter_id: reporterId,
    p_points: points,
    p_reason: reason || null,
  });
  if (error) throw new Error(error.message);
  return data as AdminTransferBountyResult;
}
