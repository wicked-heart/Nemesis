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
} from './types';

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

export async function getGameState(): Promise<GameSessionState | null> {
  const token = getSessionToken();
  if (!token) return null;

  const { data, error } = await supabase.rpc('get_game_state', {
    p_session_token: token,
  });
  if (error) throw new Error(error.message);
  if (!data || (data as { error?: string }).error) return null;
  return data as GameSessionState;
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
