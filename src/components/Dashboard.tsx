import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Target,
  Award,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  Shield,
  HelpCircle,
  Eye,
  LogOut,
  Sparkles,
  ArrowRight,
  List,
  History,
  Clock,
  Zap,
  Lock,
} from 'lucide-react';
import {
  getGameState,
  beginRound,
  revealNextClue,
  submitGuess,
  timeoutRound,
  clearSessionToken,
} from '@/lib/api';
import type { GameSessionState, ClueItem, GuessRecord } from '@/lib/types';
import DoomFace from './DoomFace';
import Backdrop from './backdrop/Backdrop';
import Doom3D from './doom3d/Doom3D';
import SignalLostOverlay from './SignalLostOverlay';
import Round2TeamCard from './Round2TeamCard';
import { useLockStatus } from '@/hooks/useLockStatus';
import { sounds } from '@/lib/sound';

interface DashboardProps {
  onComplete: () => void;
  onExit: () => void;
}

export default function Dashboard({ onComplete, onExit }: DashboardProps) {
  const [session, setSession] = useState<GameSessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [guessInput, setGuessInput] = useState('');
  const [guessSubmitting, setGuessSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
    details?: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'current' | 'all-unlocked' | 'history'>('current');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      const data = await getGameState();
      if (!data) {
        clearSessionToken();
        onExit();
        return;
      }
      setSession(data);
      if ((data.round_status === 'COMPLETED' || data.round_status === 'FAILED') && data.player_status !== 'PENALTY_PENDING') {
        onComplete();
      }
    } catch (err) {
      console.error('Error fetching game state:', err);
    } finally {
      setLoading(false);
    }
  }, [onComplete, onExit]);

  // Hook for realtime lock status and phase transitions (Glitch -> Signal Lost -> Pardon)
  const { phase: lockPhase, isLocked } = useLockStatus({
    playerStatus: session?.player_status || 'NORMAL',
    sessionId: session?.id,
    onRefreshSession: fetchSession,
  });

  // Client-side auto-advance safeguard: if unlocked and current clue already had a wrong guess, auto-advance
  const autoAdvancingRef = useRef(false);
  useEffect(() => {
    if (
      session &&
      session.round_status === 'ACTIVE' &&
      session.player_status === 'NORMAL' &&
      !isLocked &&
      !autoAdvancingRef.current &&
      session.current_clue < 15
    ) {
      const hasWrongGuessOnCurrent = session.guesses.some(
        (g) => g.clue_number === session.current_clue && !g.is_correct
      );
      if (hasWrongGuessOnCurrent) {
        autoAdvancingRef.current = true;
        revealNextClue()
          .then(() => fetchSession())
          .catch((e) => console.error('Auto-advance clue error:', e))
          .finally(() => {
            autoAdvancingRef.current = false;
          });
      }
    }
  }, [session, isLocked, fetchSession]);


  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // 15-Minute Countdown Timer Hook (900 seconds)
  useEffect(() => {
    if (!session || session.round_status !== 'ACTIVE' || !session.started_at) {
      setSecondsRemaining(null);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const checkTime = async () => {
      const startTime = new Date(session.started_at!).getTime();
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, 900 - elapsed);
      setSecondsRemaining(remaining);

      if (remaining <= 0 && !hasTimedOut) {
        setHasTimedOut(true);
        if (timerRef.current) clearInterval(timerRef.current);
        setFeedback({
          type: 'error',
          message: '15-MINUTE TIME LIMIT EXHAUSTED!',
          details: 'Your trial period has concluded. Automatically submitting round and generating performance dossier...',
        });
        try {
          await timeoutRound();
        } catch (e) {
          console.error('Auto timeout error:', e);
        }
        setTimeout(() => {
          onComplete();
        }, 1500);
      }
    };

    checkTime();
    timerRef.current = setInterval(checkTime, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session, hasTimedOut, onComplete]);

  const handleBeginRound = async () => {
    sounds.playClick();
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await beginRound();
      if (res.error) {
        sounds.playError();
        setFeedback({ type: 'error', message: res.error });
        return;
      }
      sounds.playSuccess();
      await fetchSession();
    } catch (err) {
      sounds.playError();
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to begin round',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevealNextClue = async () => {
    if (!session || session.round_status !== 'ACTIVE' || session.current_clue >= 15 || isLocked) return;
    sounds.playClick();
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await revealNextClue();
      if (res.timed_out || res.error === 'round_timed_out') {
        sounds.playError();
        setFeedback({
          type: 'error',
          message: '15-minute countdown expired. Automatically finalizing round...',
        });
        setTimeout(() => onComplete(), 1500);
        return;
      }
      if (res.error) {
        sounds.playError();
        setFeedback({ type: 'error', message: res.error });
        return;
      }
      try {
        sounds.playClueReveal();
      } catch {
        // fallback
      }
      await fetchSession();
      setActiveTab('current');
    } catch (err) {
      sounds.playError();
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to reveal next clue',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitGuess = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = guessInput.trim();
    if (!trimmed || guessSubmitting || isLocked) return;

    // Frontend guard: 1 chance per clue
    const hasAlreadyGuessed = session?.guesses.some(
      (g) => g.clue_number === session.current_clue
    );
    if (hasAlreadyGuessed) {
      sounds.playError();
      setFeedback({
        type: 'warning',
        message: `Attempt already used for Clue ${session?.current_clue}.`,
        details: 'You only get one chance per clue to guess the domain (15 attempts maximum). Reveal the next clue to continue.',
      });
      return;
    }

    sounds.playClick();
    setGuessSubmitting(true);
    setFeedback(null);

    try {
      const res = await submitGuess(trimmed);
      setGuessInput('');

      if (res.timed_out || res.error === 'round_timed_out') {
        sounds.playError();
        setFeedback({
          type: 'error',
          message: '15-minute countdown expired. Automatically submitting round...',
          details: `The hidden domain was: ${res.domain_name || 'Assigned Domain'}`,
        });
        setTimeout(() => onComplete(), 1600);
        return;
      }

      if (res.error === 'player_locked') {
        sounds.playError();
        setFeedback({
          type: 'error',
          message: 'TRANSMISSION SEVERED BY DOOM',
          details: 'Terminal locked in penance. Await admin pardon to restore signal.',
        });
        await fetchSession();
        return;
      }

      if (res.error === 'already_guessed_on_clue') {
        sounds.playError();
        setFeedback({
          type: 'warning',
          message: `Attempt already used for Clue ${session?.current_clue}!`,
          details: 'Each clue permits only one domain guess (maximum 15 attempts total). Reveal the next clue to continue.',
        });
        await fetchSession();
        return;
      }

      if (res.correct) {
        sounds.playSuccess();
        const bonusText = res.time_multiplier && res.time_multiplier !== 1
          ? ` (${res.time_multiplier}x ${res.speed_tier} Speed Multiplier applied)`
          : '';
        setFeedback({
          type: 'success',
          message: `CORRECT DOMAIN IDENTIFIED! Flag confirmed: ${res.domain_name || trimmed}`,
          details: `Score Awarded: +${res.score ?? 0} points${bonusText}. Round 1 completed successfully!`,
        });
        setTimeout(() => {
          onComplete();
        }, 1800);
      } else {
        sounds.playError();
        if (res.exhausted) {
          setFeedback({
            type: 'error',
            message: 'Final attempt (15/15) incorrect. Transmission severed!',
            details: 'Maximum 15 attempts reached. Screen locked in penance. Await admin unlock to conclude your trial.',
          });
          await fetchSession();
        } else {
          setFeedback({
            type: 'warning',
            message: `"${trimmed}" is incorrect. Strike ${res.wrong_guess_count || (session?.wrong_guess_count ?? 0) + 1}/15 recorded.`,
            details: `Screen locked. Await admin unlock to restore signal and automatically advance to Clue ${(session?.current_clue ?? 1) + 1}.`,
          });
          await fetchSession();
        }
      }
    } catch (err) {
      sounds.playError();
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Submission failed',
      });
    } finally {
      setGuessSubmitting(false);
    }
  };

  const handleLogout = () => {
    sounds.playClick();
    clearSessionToken();
    onExit();
  };

  if (loading) {
    return (
      <div className="min-h-screen cyber-grid scanlines flex items-center justify-center relative">
        <Backdrop calm />
        <div className="text-center relative z-10 font-mono">
          <Loader2 size={36} className="animate-spin text-doom-green mx-auto mb-4" />
          <p className="text-gray-400 text-[11px] tracking-[0.22em]">SYNCHRONIZING WITH NEMESIS VAULT...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen cyber-grid scanlines flex items-center justify-center relative px-4">
        <Backdrop calm />
        <div className="terminal-panel p-8 max-w-sm w-full text-center relative z-10">
          <p className="text-gray-400 text-sm mb-6">No active session found.</p>
          <button onClick={onExit} className="cyber-btn text-sm">
            Return to Gates
          </button>
        </div>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentClueObj = session.unlocked_clues.find(
    (c) => c.clue_number === session.current_clue
  );

  const currentClueHasGuess = Boolean(
    session.guesses.some((g) => g.clue_number === session.current_clue)
  );

  return (
    <div className="min-h-screen cyber-grid scanlines text-gray-200 flex flex-col relative selection:bg-doom-green selection:text-black">
      <Backdrop calm />

      {/* --- Game HUD (top bar) --- */}
      <header className="hud-header relative md:sticky md:top-0 z-30 border-b border-doom-line bg-doom-void/95">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
          {/* Left: Participant Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 hidden sm:block">
              <DoomFace size={30} />
            </div>
            <span className="flex h-2 w-2 relative shrink-0 sm:hidden">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-doom-green opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-doom-green"></span>
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-semibold text-gray-50 truncate">{session.participant_name}</span>
                {session.team?.is_assigned && (
                  <span className="chip !py-0.5 text-cyan-300 border-cyan-500/40 bg-cyan-500/10">
                    TEAM: {session.team.team_name}
                  </span>
                )}
              </div>
              <span className="font-mono text-[11px] text-gray-500">[RRN: {session.participant_id}]</span>
            </div>
          </div>

          {/* Center: Live Countdown & Status Badges */}
          <div className="flex flex-wrap items-center gap-2 order-3 w-full md:order-none md:w-auto">
            {/* 15-Min Live Countdown Pill */}
            {session.round_status === 'ACTIVE' && secondsRemaining !== null && (
              <div
                className={`px-3.5 py-1.5 rounded-full border font-mono font-bold flex items-center gap-2 transition-all ${
                  secondsRemaining <= 60
                    ? 'bg-red-950/80 border-red-500 text-red-400 animate-pulse shadow-[0_0_18px_rgba(239,68,68,0.45)]'
                    : secondsRemaining <= 300
                    ? 'bg-amber-950/70 border-amber-500/70 text-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.3)]'
                    : 'bg-doom-green/10 border-doom-green/40 text-doom-glow shadow-[0_0_18px_-4px_rgba(34,197,94,0.45)]'
                }`}
                title="15-minute countdown timer. Auto-submits when time expires."
              >
                <Clock size={14} className={secondsRemaining <= 60 ? 'animate-spin' : ''} />
                <span className="text-base tracking-[0.12em] tabular-nums">
                  {formatTime(secondsRemaining)}
                </span>
                <span className="text-[10px] text-gray-500 font-medium">/ 15:00</span>
                {secondsRemaining <= 60 && (
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 font-extrabold tracking-wider">
                    CRITICAL
                  </span>
                )}
              </div>
            )}

            {/* Round Status */}
            <span
              className={`chip ${
                session.round_status === 'ACTIVE'
                  ? 'border-doom-green/40 bg-doom-green/10 text-doom-glow'
                  : session.round_status === 'COMPLETED'
                  ? 'border-blue-500/40 bg-blue-950/50 text-blue-300'
                  : session.round_status === 'FAILED'
                  ? 'border-red-500/40 bg-red-950/50 text-red-300'
                  : 'text-gray-400'
              }`}
            >
              ROUND: {session.round_status}
            </span>

            {/* Player Status */}
            <span
              className={`chip ${
                session.player_status === 'PENALTY_PENDING'
                  ? 'border-amber-500/60 bg-amber-950/70 text-amber-500 animate-pulse'
                  : 'text-gray-300'
              }`}
            >
              {session.player_status === 'PENALTY_PENDING' && <AlertTriangle size={11} />}
              PLAYER: {session.player_status === 'PENALTY_PENDING' ? 'PENALTY PENDING' : 'NORMAL'}
            </span>
          </div>

          {/* Right: Score, Wrong, Exit */}
          <div className="flex items-center gap-2">
            <div className="chip text-gray-400">
              <Award size={12} className="text-doom-glow" />
              <span>SCORE:</span>
              <span className="text-doom-glow text-xs">{session.score}</span>
            </div>

            <div className="chip text-gray-400">
              <XCircle size={12} className="text-red-400" />
              <span>WRONG:</span>
              <span className="text-red-400 text-xs">{session.wrong_guess_count}</span>
            </div>

            <button
              onClick={() => setShowExitConfirm(true)}
              className="w-8 h-8 grid place-items-center rounded-full border border-doom-line text-gray-500 hover:text-red-400 hover:border-red-500/40 transition-colors"
              title="Exit to Gates"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* --- Main: the game on the left, Round 2 team on the right --- */}
      <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
        <div className="min-w-0 space-y-6">
          {/* Doom watches the game (phones) */}
          <div className="lg:hidden flex justify-center -mt-3 -mb-4">
            <Doom3D mode="mask" maxWidth={1023} className="doom-stage relative w-44 h-44" />
          </div>

          {/* VIEW A: NOT STARTED — Briefing & Begin Round 1 */}
          {session.round_status === 'NOT_STARTED' && (
            <div className="terminal-panel p-6 sm:p-10 w-full text-center animate-fade-in">
              <div className="flex justify-center mb-6">
                <DoomFace size={88} />
              </div>

              <span className="eyebrow">
                <span>NEMESIS // ROUND 1</span>
              </span>

              <h1 className="display text-[clamp(2.4rem,6vw,3.8rem)] mt-4">
                FIND THE FLAG
              </h1>
              <div className="hairline w-48 mx-auto mt-5 mb-8" />

              <div className="text-left text-[13px] sm:text-sm text-gray-300 space-y-3.5 mb-9 glass p-5 sm:p-6 leading-relaxed">
                <p className="flex items-start gap-3">
                  <span className="text-doom-green font-bold">&bull;</span>
                  <span>
                    You have been assigned <strong className="text-gray-50">one hidden domain</strong> from the 10 candidate fields.
                  </span>
                </p>
                <p className="flex items-start gap-3">
                  <span className="text-doom-green font-bold">&bull;</span>
                  <span>
                    There are <strong className="text-gray-50">15 progressive clues</strong> ordered from difficult &amp; ambiguous to clearly identifiable.
                  </span>
                </p>
                <p className="flex items-start gap-3">
                  <span className="text-doom-green font-bold">&bull;</span>
                  <span>
                    Clicking <strong className="text-gray-50">Begin Round 1</strong> initiates a strict <strong className="text-gray-50">15-minute countdown (15:00)</strong>. Once 15 minutes expire, your round is <strong className="text-gray-50">automatically submitted</strong> and your final performance dossier is displayed!
                  </span>
                </p>
                <p className="flex items-start gap-3">
                  <span className="text-doom-green font-bold">&bull;</span>
                  <span>
                    <strong className="text-gray-50">Speed Multipliers:</strong> Solves under 2 min earn a <strong className="text-gray-50">1.30x Lightning Bonus</strong>; 2–5 min earn a <strong className="text-gray-50">1.15x Swift Bonus</strong>; 5–10 min standard (1.0x); 10–15 min (0.90x).
                  </span>
                </p>
                <p className="flex items-start gap-3">
                  <span className="text-doom-green font-bold">&bull;</span>
                  <span>
                    <strong className="text-gray-50">One Chance Per Clue:</strong> You get only <strong className="text-gray-50">1 attempt per clue</strong> to identify the domain. Across all 15 clues, you have a <strong className="text-gray-50">maximum of 15 attempts total</strong>.
                  </span>
                </p>
                <p className="flex items-start gap-3">
                  <span className="text-red-400 font-bold">&bull;</span>
                  <span>
                    <strong className="text-gray-50">Lockout &amp; Auto-Advance:</strong> If you guess incorrectly, your screen immediately locks in penance. Once an administrator unlocks your terminal, you are <strong className="text-gray-50">automatically sent to the next clue</strong>!
                  </span>
                </p>
                <p className="flex items-start gap-3">
                  <span className="text-gray-500 font-bold">&bull;</span>
                  <span>
                    Revealing the next clue without guessing never penalizes you.
                  </span>
                </p>
              </div>

              <button
                onClick={handleBeginRound}
                disabled={actionLoading}
                onMouseEnter={() => sounds.playHover()}
                className="cyber-btn text-base px-10 py-4 w-full sm:w-auto flex items-center justify-center gap-2 mx-auto"
              >
                {actionLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> INITIALIZING ROUND 1...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} /> BEGIN ROUND 1
                  </>
                )}
              </button>
            </div>
          )}

          {/* VIEW B: ACTIVE — Clue Screen, Progressive Stepper & Guess Submission */}
          {session.round_status === 'ACTIVE' && (
            <div className="w-full space-y-5 animate-fade-in">
              {/* 15-Minute Countdown & Speed Multiplier */}
              {secondsRemaining !== null && (
                <div className="terminal-panel px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Clock
                        size={18}
                        className={secondsRemaining <= 60 ? 'text-red-400 animate-spin' : secondsRemaining <= 300 ? 'text-amber-400' : 'text-doom-green'}
                      />
                      <div>
                        <div className="font-mono text-[10px] tracking-[0.2em] text-gray-500">15-MIN COUNTDOWN:</div>
                        <span
                          className={`font-mono font-bold tracking-[0.08em] tabular-nums text-2xl ${
                            secondsRemaining <= 60
                              ? 'text-red-400 animate-pulse'
                              : secondsRemaining <= 300
                              ? 'text-amber-400'
                              : 'text-gray-50'
                          }`}
                        >
                          {formatTime(secondsRemaining)} <span className="text-[10px] tracking-[0.2em] text-gray-500 font-normal">REMAINING</span>
                        </span>
                      </div>
                    </div>

                    {/* Active Speed Tier */}
                    <div className="flex items-center gap-1.5">
                      {secondsRemaining > 780 ? (
                        <span className="chip border-doom-green/50 bg-doom-green/15 text-doom-glow shadow-[0_0_16px_-4px_rgba(34,197,94,0.6)]">
                          <Zap size={11} /> LIGHTNING BONUS (1.30x)
                        </span>
                      ) : secondsRemaining > 600 ? (
                        <span className="chip border-cyan-500/50 bg-cyan-500/10 text-cyan-300">
                          <Zap size={11} /> SWIFT BONUS (1.15x)
                        </span>
                      ) : secondsRemaining > 300 ? (
                        <span className="chip text-gray-300">
                          STANDARD SPEED (1.00x)
                        </span>
                      ) : (
                        <span className="chip border-amber-500/50 bg-amber-950/60 text-amber-400 animate-pulse">
                          OVERTIME (0.90x)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress track */}
                  <div className="w-full bg-white/[0.04] h-1.5 rounded-full overflow-hidden mt-4">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        secondsRemaining <= 60
                          ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]'
                          : secondsRemaining <= 300
                          ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)]'
                          : 'bg-gradient-to-r from-emerald-700 via-doom-green to-emerald-300 shadow-[0_0_10px_rgba(34,197,94,0.6)]'
                      }`}
                      style={{ width: `${Math.max(0, Math.min(100, (secondsRemaining / 900) * 100))}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Clue progress rail + tabs */}
              <div className="terminal-panel px-5 py-5 sm:px-6">
                <div className="flex items-center justify-between gap-3 font-mono text-[11px] tracking-[0.16em]">
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <Eye size={13} className="text-doom-green" /> CLUE SEQUENCE PROGRESS
                  </span>
                  <span className="text-gray-200 font-bold">
                    CLUE {session.current_clue} / 15 UNLOCKED
                  </span>
                </div>

                {/* 15 clue steps */}
                <div className="flex items-end gap-1 sm:gap-1.5 mt-4">
                  {Array.from({ length: 15 }, (_, i) => i + 1).map((num) => {
                    const isCurrent = num === session.current_clue;
                    const isUnlocked = num <= session.current_clue;
                    return (
                      <div
                        key={num}
                        title={`Clue ${num}${isUnlocked ? ' (Unlocked)' : ' (Locked)'}`}
                        className="flex-1 flex flex-col items-center gap-1.5 group cursor-default"
                      >
                        <div
                          className={`w-full rounded-full transition-all duration-300 ${
                            isCurrent
                              ? 'h-2.5 bg-doom-glow shadow-[0_0_14px_#22c55e]'
                              : isUnlocked
                              ? 'h-1.5 bg-doom-green/70'
                              : 'h-1.5 bg-white/[0.07]'
                          }`}
                        />
                        <span
                          className={`text-[9px] font-mono leading-none ${
                            isCurrent
                              ? 'text-doom-glow font-bold'
                              : isUnlocked
                              ? 'text-emerald-400/70'
                              : 'text-gray-600'
                          }`}
                        >
                          {num}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Tab Navigation */}
                <div className="segmented mt-5">
                  <button
                    onClick={() => setActiveTab('current')}
                    className={`segment ${activeTab === 'current' ? 'segment-active' : ''}`}
                  >
                    <Eye size={12} /> Current Clue ({session.current_clue})
                  </button>
                  <button
                    onClick={() => setActiveTab('all-unlocked')}
                    className={`segment ${activeTab === 'all-unlocked' ? 'segment-active' : ''}`}
                  >
                    <List size={12} /> All Unlocked ({session.unlocked_clues.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('history')}
                    className={`segment ${activeTab === 'history' ? 'segment-active' : ''}`}
                  >
                    <History size={12} /> Guess Log ({session.guesses.length})
                  </button>
                </div>
              </div>

              {/* TAB 1: Current Clue & Interaction Controls */}
              {activeTab === 'current' && (
                <div className="space-y-5">
                  {/* Featured Clue Card */}
                  <div className="terminal-panel energy p-6 sm:p-9 relative overflow-hidden">
                    <div aria-hidden className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgba(34,197,94,0.12),transparent_70%)]" />
                    <div className="relative flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="chip border-doom-green/40 bg-doom-green/10 text-doom-glow">
                          CLUE {session.current_clue} / 15
                        </span>
                        <span className="text-gray-500 text-[11px] font-mono tracking-[0.16em] hidden sm:inline">
                          // PROGRESSIVE INTEL
                        </span>
                      </div>

                      <div className="text-xs text-gray-400">
                        Potential Score: <strong className="font-mono text-doom-glow">
                          {session.current_clue <= 4
                            ? '15 PTS'
                            : session.current_clue <= 7
                            ? '12 PTS'
                            : session.current_clue <= 10
                            ? '9 PTS'
                            : session.current_clue <= 13
                            ? '6 PTS'
                            : '3 PTS'}
                        </strong>
                      </div>
                    </div>

                    {/* Clue Text Content */}
                    <div className="relative my-10 sm:my-12 min-h-[110px] flex items-center justify-center px-1 sm:px-6">
                      {isLocked ? (
                        <div className="text-center py-2 animate-pulse">
                          <div className="chip border-red-500/40 bg-red-950/60 text-red-400 mb-4">
                            <Lock size={12} /> SIGNAL SEVERED BY DOOM
                          </div>
                          <p className="font-regal text-xl sm:text-2xl text-red-300/80 text-center leading-relaxed font-semibold tracking-wide">
                            [ ██████████ ENCRYPTED BY DOOM ██████████ ]
                          </p>
                        </div>
                      ) : (
                        <p key={session.current_clue} className="clue-decrypt font-regal text-[1.6rem] sm:text-[2.1rem] text-gray-50 text-center leading-snug font-semibold drop-shadow-[0_0_24px_rgba(34,197,94,0.18)]">
                          "{currentClueObj?.clue_text || 'Decrypting transmission...'}"
                        </p>
                      )}
                    </div>

                    {/* Reveal Next Clue Action */}
                    <div className="relative pt-5 border-t border-doom-line flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                      <div className="text-gray-400 text-center sm:text-left">
                        <span className="text-doom-green font-semibold">Tip:</span> Revealing the next clue does not count as a guess &amp; incurs no penalty.
                      </div>

                      {session.current_clue < 15 ? (
                        <button
                          onClick={handleRevealNextClue}
                          disabled={actionLoading || isLocked}
                          onMouseEnter={() => sounds.playHover()}
                          className={`cyber-btn cyber-btn-cyan text-xs px-5 py-2.5 flex items-center gap-1.5 whitespace-nowrap w-full sm:w-auto justify-center ${
                            isLocked ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          {actionLoading ? (
                            <>
                              <Loader2 size={13} className="animate-spin" /> REVEALING...
                            </>
                          ) : (
                            <>
                              <span>Reveal Clue {session.current_clue + 1}</span>
                              <ArrowRight size={13} />
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="chip text-doom-steel">
                          FINAL CLUE REACHED (15/15)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Guess Submission Card */}
                  <div className="terminal-panel p-5 sm:p-7">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2 font-mono text-[11px] text-gray-200 font-bold tracking-[0.14em]">
                        <Target size={14} className="text-doom-green" />
                        <span>IDENTIFY THE HIDDEN DOMAIN (CLUE {session.current_clue} / 15)</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`chip ${
                          currentClueHasGuess
                            ? 'border-amber-500/50 bg-amber-950/60 text-amber-300'
                            : 'border-doom-green/40 bg-doom-green/10 text-doom-glow'
                        }`}>
                          {currentClueHasGuess ? 'CHANCE USED FOR THIS CLUE' : '1 CHANCE ALLOCATED'}
                        </span>
                        <span className="chip text-gray-300">
                          ATTEMPTS: {session.wrong_guess_count} / 15 MAX
                        </span>
                      </div>
                    </div>

                    <form onSubmit={handleSubmitGuess} className="space-y-4">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="text"
                          value={guessInput}
                          onChange={(e) => setGuessInput(e.target.value)}
                          placeholder={
                            isLocked
                              ? "Transmission locked by Doom..."
                              : currentClueHasGuess
                              ? `1 chance used on Clue ${session.current_clue}. Advance to next clue.`
                              : `Enter domain guess (1 chance on Clue ${session.current_clue})...`
                          }
                          disabled={guessSubmitting || isLocked || currentClueHasGuess}
                          className="cyber-input flex-1 text-[15px] py-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
                          autoFocus={!isLocked && !currentClueHasGuess}
                        />
                        <button
                          type="submit"
                          disabled={guessSubmitting || !guessInput.trim() || isLocked || currentClueHasGuess}
                          className="cyber-btn text-sm px-6 py-3.5 flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {guessSubmitting ? (
                            <>
                              <Loader2 size={14} className="animate-spin" /> VERIFYING...
                            </>
                          ) : currentClueHasGuess ? (
                            <>
                              <Lock size={14} className="text-amber-700" /> CHANCE USED
                            </>
                          ) : (
                            <>
                              <Shield size={14} /> SUBMIT GUESS (1 CHANCE)
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center justify-between text-[12px] text-gray-400 pt-3 gap-2 border-t border-doom-line">
                        <div className="flex items-center gap-2">
                          <span className={currentClueHasGuess ? "text-amber-400 font-bold" : "text-doom-green font-bold"}>
                            &bull;
                          </span>
                          <span>
                            {currentClueHasGuess
                              ? `You have already used your 1 attempt for Clue ${session.current_clue}. Reveal the next clue to continue.`
                              : `You have 1 attempt for Clue ${session.current_clue}. Maximum 15 attempts total across the entire round.`}
                          </span>
                        </div>
                        <div className="text-gray-500 text-[11px]">
                          Wrong guess locks terminal &bull; Admin unlock automatically advances to next clue
                        </div>
                      </div>
                    </form>
                  </div>

                  {/* Live Feedback Notification Banner */}
                  {feedback && (
                    <div
                      className={`px-5 py-4 rounded-2xl border text-sm animate-fade-in ${
                        feedback.type === 'success'
                          ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200 shadow-[0_0_40px_-12px_rgba(34,197,94,0.6)]'
                          : feedback.type === 'warning'
                          ? 'bg-amber-950/60 border-amber-500/50 text-amber-200'
                          : 'bg-red-950/60 border-red-500/50 text-red-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {feedback.type === 'success' ? (
                          <CheckCircle2 size={20} className="text-doom-green shrink-0 mt-0.5" />
                        ) : feedback.type === 'warning' ? (
                          <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="font-semibold">{feedback.message}</div>
                          {feedback.details && <p className="mt-1 text-[13px] text-gray-300">{feedback.details}</p>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: All Unlocked Clues (Archive Viewer) */}
              {activeTab === 'all-unlocked' && (
                <div className="terminal-panel p-5 sm:p-7 space-y-5 animate-fade-in">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-doom-line font-mono text-[11px] tracking-[0.14em]">
                    <span className="text-gray-200 font-bold flex items-center gap-1.5">
                      <List size={14} className="text-doom-green" /> UNLOCKED CLUE ARCHIVES ({session.unlocked_clues.length} / 15)
                    </span>
                    <span className="text-gray-500">REVIEW ALL REVEALED TRANSMISSIONS</span>
                  </div>

                  <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                    {session.unlocked_clues.map((clue) => (
                      <div
                        key={clue.clue_number}
                        className={`p-4 rounded-xl border transition-colors ${
                          clue.clue_number === session.current_clue
                            ? 'bg-doom-green/[0.06] border-doom-green/40 shadow-[0_0_24px_-10px_rgba(34,197,94,0.5)]'
                            : 'bg-white/[0.02] border-doom-line'
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono text-[11px] mb-2">
                          <span className="font-bold text-doom-green tracking-[0.14em]">CLUE #{String(clue.clue_number).padStart(2, '0')}</span>
                          {clue.clue_number === session.current_clue && (
                            <span className="text-[10px] text-doom-steel uppercase font-bold tracking-[0.14em]">
                              [CURRENT ACTIVE CLUE]
                            </span>
                          )}
                        </div>
                        <p className="text-gray-100 leading-relaxed text-[15px]">
                          {clue.clue_text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: Guess History Log */}
              {activeTab === 'history' && (
                <div className="terminal-panel p-5 sm:p-7 space-y-5 animate-fade-in">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-doom-line font-mono text-[11px] tracking-[0.14em]">
                    <span className="text-gray-200 font-bold flex items-center gap-1.5">
                      <History size={14} className="text-doom-green" /> ATTEMPT AUDIT LOG ({session.guesses.length})
                    </span>
                    <span className="text-gray-500">CHRONOLOGICAL ATTEMPTS</span>
                  </div>

                  {session.guesses.length === 0 ? (
                    <p className="text-gray-500 text-center text-sm py-10">No guesses submitted yet for this session.</p>
                  ) : (
                    <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                      {session.guesses.map((g, idx) => (
                        <div
                          key={idx}
                          className={`px-4 py-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                            g.is_correct
                              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                              : 'bg-red-950/25 border-red-900/40 text-red-200'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-[15px] truncate">
                              "{g.submitted_answer}"
                            </div>
                            <div className="font-mono text-[11px] text-gray-500 mt-1">
                              Submitted at Clue #{g.clue_number} &bull; {new Date(g.created_at).toLocaleTimeString()}
                            </div>
                          </div>
                          <span
                            className={`chip shrink-0 ${
                              g.is_correct
                                ? 'border-emerald-500/40 bg-emerald-900/50 text-emerald-300'
                                : 'border-red-500/40 bg-red-900/40 text-red-300'
                            }`}
                          >
                            {g.is_correct ? 'CORRECT' : 'INCORRECT'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Round 2 Tactical Syndicate Dossier */}
        <aside className="w-full space-y-4">
          {/* Doom watches the game (laptops): eyes flare while you type a guess */}
          <div className="hidden lg:block">
            <Doom3D mode="watch" minWidth={1024} className="doom-stage relative w-full h-[340px] -mt-2 -mb-2" />
          </div>
          <Round2TeamCard
            initialTeam={session.team}
            currentParticipantName={session.participant_name}
            currentParticipantId={session.participant_id}
            currentScore={session.score}
          />
        </aside>
      </main>

      {/* --- Footer Status Bar --- */}
      <footer className="relative z-10 border-t border-doom-line px-4 sm:px-6 py-4 font-mono text-[11px] tracking-[0.14em] text-gray-500">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-2">
          <span>NEMESIS PROTOCOL // PERSISTENT VAULT SYNCHRONIZED</span>
          <span className="text-doom-green">ROUND 1: FIND THE FLAG</span>
        </div>
      </footer>

      {/* --- Corrupted Signal Lock Screen (Dr. Doom Protocol) --- */}
      {session && (
        <SignalLostOverlay
          phase={lockPhase}
          playerName={session.participant_name}
          rrn={session.participant_id}
          strikeCount={session.wrong_guess_count}
          unlockedClues={session.unlocked_clues}
          currentClueNumber={session.current_clue}
        />
      )}

      {/* --- Exit Confirmation Modal --- */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 animate-fade-in">
          <div className="terminal-panel max-w-sm w-full p-7 text-center">
            <div className="w-14 h-14 rounded-full grid place-items-center mx-auto mb-4 bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="text-amber-500" size={26} />
            </div>
            <h3 className="font-regal text-xl text-gray-50 font-bold mb-2">
              SUSPEND CURRENT SESSION?
            </h3>
            <p className="text-[13px] text-gray-400 mb-7 leading-relaxed">
              Your progress and assigned domain remain stored in the database. You can resume anytime with your ID.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="cyber-btn cyber-btn-cyan text-xs px-5"
              >
                Continue Playing
              </button>
              <button
                onClick={handleLogout}
                className="cyber-btn cyber-btn-danger text-xs px-5"
              >
                Exit to Gates
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
