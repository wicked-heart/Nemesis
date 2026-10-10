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
import DoomMask from './DoomMask';
import ArcaneCanvas from './ArcaneCanvas';
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
      if (data.round_status === 'COMPLETED' || data.round_status === 'FAILED') {
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
            message: 'Final guess incorrect after Clue 15. Round 1 has failed.',
            details: `The correct domain was: ${res.domain_name}`,
          });
          setTimeout(() => {
            onComplete();
          }, 2000);
        } else {
          setFeedback({
            type: 'warning',
            message: `"${trimmed}" is incorrect. Wrong guess recorded.`,
            details: 'Player status updated to PENALTY_PENDING. Transmission severed until pardoned by an admin.',
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
        <ArcaneCanvas />
        <div className="text-center relative z-10 font-mono">
          <Loader2 size={36} className="animate-spin text-[#10b981] mx-auto mb-3" />
          <p className="text-gray-400 text-xs">SYNCHRONIZING WITH NEMESIS VAULT...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen cyber-grid scanlines flex items-center justify-center relative">
        <ArcaneCanvas />
        <div className="terminal-panel p-6 max-w-sm text-center font-mono relative z-10">
          <p className="text-gray-400 text-xs mb-4">No active session found.</p>
          <button onClick={onExit} className="cyber-btn text-xs">
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

  return (
    <div className="min-h-screen cyber-grid scanlines text-gray-200 flex flex-col justify-between relative selection:bg-[#10b981] selection:text-black">
      <ArcaneCanvas />

      {/* --- Sovereign Command Header --- */}
      <header className="relative z-20 border-b border-gray-800/80 bg-[#020704]/90 backdrop-blur-md px-4 py-2.5">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          {/* Left: Participant Identity */}
          <div className="flex items-center gap-3">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]"></span>
            </span>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="text-[#10b981] font-bold tracking-wide">{session.participant_name}</span>
              <span className="text-gray-500 text-[11px]">[RRN: {session.participant_id}]</span>
              {session.team?.is_assigned && (
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold flex items-center gap-1">
                  TEAM: {session.team.team_name}
                </span>
              )}
            </div>
          </div>

          {/* Center: Live Countdown & Status Badges */}
          <div className="flex items-center gap-2 text-[11px]">
            {/* 15-Min Live Countdown Pill */}
            {session.round_status === 'ACTIVE' && secondsRemaining !== null && (
              <div
                className={`px-2.5 py-1 rounded border font-mono font-bold flex items-center gap-1.5 transition-all ${
                  secondsRemaining <= 60
                    ? 'bg-red-950/80 border-red-500 text-red-400 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.4)]'
                    : secondsRemaining <= 300
                    ? 'bg-amber-950/70 border-amber-500/70 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                    : 'bg-emerald-950/50 border-emerald-500/50 text-[#10b981]'
                }`}
                title="15-minute countdown timer. Auto-submits when time expires."
              >
                <Clock size={12} className={secondsRemaining <= 60 ? 'animate-spin' : ''} />
                <span className="tracking-widest">
                  {formatTime(secondsRemaining)}
                </span>
                <span className="text-[10px] text-gray-500">/ 15:00</span>
                {secondsRemaining <= 60 && (
                  <span className="text-[9px] uppercase px-1 rounded bg-red-500/20 text-red-300 font-extrabold tracking-wider">
                    CRITICAL
                  </span>
                )}
              </div>
            )}

            {/* Round Status */}
            <span
              className={`px-2.5 py-0.5 rounded border font-bold uppercase tracking-wider ${
                session.round_status === 'ACTIVE'
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-[#10b981]'
                  : session.round_status === 'COMPLETED'
                  ? 'bg-blue-950/60 border-blue-500/50 text-blue-400'
                  : session.round_status === 'FAILED'
                  ? 'bg-red-950/60 border-red-500/50 text-red-400'
                  : 'bg-gray-900 border-gray-700 text-gray-400'
              }`}
            >
              ROUND: {session.round_status}
            </span>

            {/* Player Status */}
            <span
              className={`px-2.5 py-0.5 rounded border font-bold uppercase tracking-wider flex items-center gap-1 ${
                session.player_status === 'PENALTY_PENDING'
                  ? 'bg-amber-950/70 border-amber-500/60 text-[#f59e0b] animate-pulse'
                  : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
              }`}
            >
              {session.player_status === 'PENALTY_PENDING' && <AlertTriangle size={11} />}
              PLAYER: {session.player_status === 'PENALTY_PENDING' ? 'PENALTY PENDING' : 'NORMAL'}
            </span>
          </div>

          {/* Right: Score, Audio, Exit */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/50 border border-gray-800 text-[11px]">
              <Award size={12} className="text-[#f59e0b]" />
              <span className="text-gray-400">SCORE:</span>
              <span className="text-[#f59e0b] font-bold">{session.score}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/50 border border-gray-800 text-[11px]">
              <XCircle size={12} className="text-red-400" />
              <span className="text-gray-400">WRONG:</span>
              <span className="text-red-400 font-bold">{session.wrong_guess_count}</span>
            </div>

            <button
              onClick={() => setShowExitConfirm(true)}
              className="text-gray-500 hover:text-red-400 transition-colors p-1"
              title="Exit to Gates"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>



      {/* --- Main Game Canvas --- */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-4xl mx-auto w-full space-y-6">
        {/* Round 2 Tactical Syndicate Dossier Banner */}
        <div className="w-full">
          <Round2TeamCard
            initialTeam={session.team}
            currentParticipantName={session.participant_name}
            currentParticipantId={session.participant_id}
            currentScore={session.score}
          />
        </div>

        {/* VIEW A: NOT STARTED — Briefing & Begin Round 1 */}
        {session.round_status === 'NOT_STARTED' && (
          <div className="terminal-panel p-6 sm:p-10 border-t-2 border-t-[#10b981] max-w-2xl w-full text-center animate-fade-in shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            <div className="flex justify-center mb-4">
              <DoomMask size={72} glow={true} withRunes={true} />
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full border border-[#f59e0b]/40 bg-[#f59e0b]/10 text-xs font-mono text-[#f59e0b] uppercase tracking-widest">
              <Target size={12} />
              <span>NEMESIS // ROUND 1</span>
            </div>

            <h1 className="font-regal text-3xl sm:text-4xl text-[#10b981] font-bold tracking-wider mb-2">
              FIND THE FLAG
            </h1>
            <div className="h-0.5 w-48 mx-auto bg-gradient-to-r from-transparent via-[#f59e0b] to-transparent mb-6" />

            <div className="text-left font-mono text-xs text-gray-300 space-y-3 mb-8 p-4 bg-black/40 border border-gray-800 rounded leading-relaxed">
              <p className="flex items-start gap-2">
                <span className="text-[#10b981] font-bold">&bull;</span>
                <span>
                  You have been assigned <strong>one hidden domain</strong> from the 10 candidate fields.
                </span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-[#10b981] font-bold">&bull;</span>
                <span>
                  There are <strong>15 progressive clues</strong> ordered from difficult &amp; ambiguous to clearly identifiable.
                </span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-[#f59e0b] font-bold">&bull;</span>
                <span>
                  Clicking <strong>Begin Round 1</strong> initiates a strict <strong>15-minute countdown (15:00)</strong>. Once 15 minutes expire, your round is <strong>automatically submitted</strong> and your final performance dossier is displayed!
                </span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-[#10b981] font-bold">&bull;</span>
                <span>
                  <strong>Speed Multipliers:</strong> Solves under 2 min earn a <strong>1.30x Lightning Bonus</strong>; 2–5 min earn a <strong>1.15x Swift Bonus</strong>; 5–10 min standard (1.0x); 10–15 min (0.90x).
                </span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-gray-400 font-bold">&bull;</span>
                <span>
                  At any point, submit your domain guess or reveal the next clue. Revealing clues never penalizes you!
                </span>
              </p>
            </div>

            <button
              onClick={handleBeginRound}
              disabled={actionLoading}
              onMouseEnter={() => sounds.playHover()}
              className="cyber-btn text-base px-10 py-3.5 w-full sm:w-auto flex items-center justify-center gap-2 mx-auto"
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
          <div className="w-full space-y-6 animate-fade-in">
            {/* 15-Minute Countdown & Speed Multiplier Banner */}
            {secondsRemaining !== null && (
              <div className="terminal-panel p-3 border border-gray-800 rounded bg-black/40 font-mono text-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock
                      size={14}
                      className={secondsRemaining <= 60 ? 'text-red-400 animate-spin' : secondsRemaining <= 300 ? 'text-amber-400' : 'text-[#10b981]'}
                    />
                    <span className="text-gray-400">15-MIN COUNTDOWN:</span>
                    <span
                      className={`font-bold tracking-wider ${
                        secondsRemaining <= 60
                          ? 'text-red-400 animate-pulse text-sm'
                          : secondsRemaining <= 300
                          ? 'text-amber-400 text-sm'
                          : 'text-[#10b981]'
                      }`}
                    >
                      {formatTime(secondsRemaining)} <span className="text-[10px] text-gray-500 font-normal">REMAINING</span>
                    </span>
                  </div>

                  {/* Active Speed Tier */}
                  <div className="flex items-center gap-1.5">
                    {secondsRemaining > 780 ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-bold text-[10px] flex items-center gap-1 shadow-[0_0_8px_rgba(16,185,129,0.3)]">
                        <Zap size={11} className="text-emerald-400" /> LIGHTNING BONUS (1.30x)
                      </span>
                    ) : secondsRemaining > 600 ? (
                      <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 font-bold text-[10px] flex items-center gap-1">
                        <Zap size={11} className="text-cyan-400" /> SWIFT BONUS (1.15x)
                      </span>
                    ) : secondsRemaining > 300 ? (
                      <span className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-300 font-bold text-[10px]">
                        STANDARD SPEED (1.00x)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/50 text-amber-400 font-bold text-[10px] animate-pulse">
                        OVERTIME (0.90x)
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress track */}
                <div className="w-full bg-gray-900 h-1.5 rounded-full overflow-hidden border border-gray-800">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      secondsRemaining <= 60
                        ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                        : secondsRemaining <= 300
                        ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                        : 'bg-[#10b981]'
                    }`}
                    style={{ width: `${Math.max(0, Math.min(100, (secondsRemaining / 900) * 100))}%` }}
                  />
                </div>
              </div>
            )}

            {/* Top Stepper Indicator */}
            <div className="terminal-panel p-4 border border-gray-800 rounded">
              <div className="flex items-center justify-between text-xs font-mono mb-2">
                <span className="text-[#10b981] font-bold tracking-wider flex items-center gap-1.5">
                  <Eye size={13} /> CLUE SEQUENCE PROGRESS
                </span>
                <span className="text-[#f59e0b] font-bold">
                  CLUE {session.current_clue} / 15 UNLOCKED
                </span>
              </div>

              {/* 15 Short Vertical Clue Bars in a Single Compact Row */}
              <div className="flex items-end gap-1.5 sm:gap-2 mt-3 mb-1">
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
                        className={`w-full rounded-sm transition-all duration-300 ${
                          isCurrent
                            ? 'h-6 bg-[#10b981] shadow-[0_0_12px_#10b981] ring-1 ring-[#10b981]'
                            : isUnlocked
                            ? 'h-5 bg-[#10b981]/70'
                            : 'h-4 bg-gray-800/80 border border-gray-700/40'
                        }`}
                      />
                      <span
                        className={`text-[9px] font-mono leading-none ${
                          isCurrent
                            ? 'text-[#10b981] font-bold'
                            : isUnlocked
                            ? 'text-emerald-400/80'
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
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-800/80 font-mono text-xs">
                <button
                  onClick={() => setActiveTab('current')}
                  className={`px-3 py-1 rounded transition-colors flex items-center gap-1.5 ${
                    activeTab === 'current'
                      ? 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Eye size={12} /> Current Clue ({session.current_clue})
                </button>
                <button
                  onClick={() => setActiveTab('all-unlocked')}
                  className={`px-3 py-1 rounded transition-colors flex items-center gap-1.5 ${
                    activeTab === 'all-unlocked'
                      ? 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <List size={12} /> All Unlocked ({session.unlocked_clues.length})
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-3 py-1 rounded transition-colors flex items-center gap-1.5 ${
                    activeTab === 'history'
                      ? 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <History size={12} /> Guess Log ({session.guesses.length})
                </button>
              </div>
            </div>

            {/* TAB 1: Current Clue & Interaction Controls */}
            {activeTab === 'current' && (
              <div className="space-y-6">
                {/* Featured Clue Card */}
                <div className="terminal-panel p-6 sm:p-8 border-t-2 border-t-[#10b981] shadow-[0_0_40px_rgba(0,0,0,0.8)] relative overflow-hidden">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-5">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-[#10b981] text-xs font-mono font-bold tracking-widest">
                        CLUE {session.current_clue} / 15
                      </span>
                      <span className="text-gray-500 text-xs font-mono hidden sm:inline">
                        // PROGRESSIVE INTEL
                      </span>
                    </div>

                    <div className="text-xs font-mono text-gray-400">
                      Potential Score: <strong className="text-[#f59e0b]">
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
                  <div className="my-6 min-h-[90px] flex items-center justify-center px-2 sm:px-6">
                    {isLocked ? (
                      <div className="text-center py-2 animate-pulse">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-red-950/60 border border-red-500/40 text-red-400 font-mono text-xs uppercase tracking-widest mb-3">
                          <Lock size={12} /> SIGNAL SEVERED BY DOOM
                        </div>
                        <p className="font-regal text-xl sm:text-2xl text-red-300/80 text-center leading-relaxed font-semibold tracking-wide">
                          [ ██████████ ENCRYPTED BY DOOM ██████████ ]
                        </p>
                      </div>
                    ) : (
                      <p className="font-regal text-xl sm:text-2xl text-emerald-100 text-center leading-relaxed font-semibold tracking-wide drop-shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                        "{currentClueObj?.clue_text || 'Decrypting transmission...'}"
                      </p>
                    )}
                  </div>

                  {/* Reveal Next Clue Action */}
                  <div className="pt-4 border-t border-gray-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
                    <div className="text-gray-400 text-center sm:text-left">
                      <span className="text-[#10b981] font-semibold">Tip:</span> Revealing the next clue does not count as a guess &amp; incurs no penalty.
                    </div>

                    {session.current_clue < 15 ? (
                      <button
                        onClick={handleRevealNextClue}
                        disabled={actionLoading || isLocked}
                        onMouseEnter={() => sounds.playHover()}
                        className={`cyber-btn cyber-btn-cyan text-xs px-4 py-2 flex items-center gap-1.5 whitespace-nowrap w-full sm:w-auto justify-center ${
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
                      <span className="text-[#f59e0b] font-bold px-3 py-1 rounded bg-black/40 border border-[#f59e0b]/30">
                        FINAL CLUE REACHED (15/15)
                      </span>
                    )}
                  </div>
                </div>

                {/* Guess Submission Card */}
                <div className="terminal-panel p-6 border border-gray-800">
                  <div className="flex items-center gap-2 mb-3 font-mono text-xs text-[#10b981] font-bold uppercase tracking-wider">
                    <Target size={14} />
                    <span>IDENTIFY THE HIDDEN DOMAIN</span>
                  </div>

                  <form onSubmit={handleSubmitGuess} className="space-y-3 font-mono">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        value={guessInput}
                        onChange={(e) => setGuessInput(e.target.value)}
                        placeholder={isLocked ? "Transmission locked by Doom..." : "Enter domain name..."}
                        disabled={guessSubmitting || isLocked}
                        className="cyber-input flex-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        autoFocus={!isLocked}
                      />
                      <button
                        type="submit"
                        disabled={guessSubmitting || !guessInput.trim() || isLocked}
                        className="cyber-btn text-xs px-6 py-2.5 flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {guessSubmitting ? (
                          <>
                            <Loader2 size={14} className="animate-spin" /> VERIFYING...
                          </>
                        ) : (
                          <>
                            <Shield size={14} /> SUBMIT GUESS
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Live Feedback Notification Banner */}
                {feedback && (
                  <div
                    className={`p-4 rounded border font-mono text-xs animate-fade-in ${
                      feedback.type === 'success'
                        ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-200'
                        : feedback.type === 'warning'
                        ? 'bg-amber-950/70 border-amber-500/60 text-amber-200'
                        : 'bg-red-950/70 border-red-500/60 text-red-200'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {feedback.type === 'success' ? (
                        <CheckCircle2 size={18} className="text-[#10b981] shrink-0 mt-0.5" />
                      ) : feedback.type === 'warning' ? (
                        <AlertTriangle size={18} className="text-[#f59e0b] shrink-0 mt-0.5" />
                      ) : (
                        <XCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-bold text-sm">{feedback.message}</div>
                        {feedback.details && <p className="mt-1 text-gray-300">{feedback.details}</p>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: All Unlocked Clues (Archive Viewer) */}
            {activeTab === 'all-unlocked' && (
              <div className="terminal-panel p-6 border border-gray-800 space-y-4 font-mono text-xs animate-fade-in">
                <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                  <span className="text-[#10b981] font-bold tracking-wider flex items-center gap-1.5">
                    <List size={14} /> UNLOCKED CLUE ARCHIVES ({session.unlocked_clues.length} / 15)
                  </span>
                  <span className="text-gray-500 text-[11px]">REVIEW ALL REVEALED TRANSMISSIONS</span>
                </div>

                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {session.unlocked_clues.map((clue) => (
                    <div
                      key={clue.clue_number}
                      className={`p-3.5 rounded border transition-colors ${
                        clue.clue_number === session.current_clue
                          ? 'bg-emerald-950/30 border-[#10b981]/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                          : 'bg-black/40 border-gray-800/80'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1.5">
                        <span className="font-bold text-[#10b981]">CLUE #{String(clue.clue_number).padStart(2, '0')}</span>
                        {clue.clue_number === session.current_clue && (
                          <span className="text-[10px] text-[#f59e0b] uppercase font-bold tracking-wider">
                            [CURRENT ACTIVE CLUE]
                          </span>
                        )}
                      </div>
                      <p className="text-gray-200 leading-relaxed font-sans text-sm">
                        {clue.clue_text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: Guess History Log */}
            {activeTab === 'history' && (
              <div className="terminal-panel p-6 border border-gray-800 space-y-4 font-mono text-xs animate-fade-in">
                <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                  <span className="text-[#f59e0b] font-bold tracking-wider flex items-center gap-1.5">
                    <History size={14} /> ATTEMPT AUDIT LOG ({session.guesses.length})
                  </span>
                  <span className="text-gray-500 text-[11px]">CHRONOLOGICAL ATTEMPTS</span>
                </div>

                {session.guesses.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No guesses submitted yet for this session.</p>
                ) : (
                  <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                    {session.guesses.map((g, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded border flex items-center justify-between ${
                          g.is_correct
                            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                            : 'bg-red-950/30 border-red-900/40 text-red-300'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-sm tracking-wide">
                            "{g.submitted_answer}"
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5">
                            Submitted at Clue #{g.clue_number} &bull; {new Date(g.created_at).toLocaleTimeString()}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                            g.is_correct
                              ? 'bg-emerald-900/80 text-emerald-300'
                              : 'bg-red-900/80 text-red-300'
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
      </main>

      {/* --- Footer Status Bar --- */}
      <footer className="relative z-10 border-t border-gray-800/80 bg-[#020704]/90 px-4 py-2.5 text-xs font-mono text-gray-500 flex flex-wrap justify-between items-center gap-2">
        <span>NEMESIS PROTOCOL // PERSISTENT VAULT SYNCHRONIZED</span>
        <span className="text-[#10b981]">ROUND 1: FIND THE FLAG</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="terminal-panel max-w-sm w-full p-6 text-center font-mono">
            <AlertTriangle className="text-[#f59e0b] mx-auto mb-3" size={32} />
            <h3 className="font-regal text-lg text-gray-200 font-bold mb-2">
              SUSPEND CURRENT SESSION?
            </h3>
            <p className="text-xs text-gray-400 mb-6 leading-relaxed">
              Your progress and assigned domain remain stored in the database. You can resume anytime with your ID.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="cyber-btn cyber-btn-cyan text-xs px-4"
              >
                Continue Playing
              </button>
              <button
                onClick={handleLogout}
                className="cyber-btn text-xs px-4"
                style={{ borderColor: '#ef4444', color: '#ef4444' }}
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
