import { useState, useEffect } from 'react';
import { Award, CheckCircle2, XCircle, Loader2, Target, Calendar, AlertTriangle, ArrowRight, Clock } from 'lucide-react';
import { getGameState, clearSessionToken } from '@/lib/api';
import type { GameSessionState } from '@/lib/types';
import DoomMask from './DoomMask';
import ArcaneCanvas from './ArcaneCanvas';
import { sounds } from '@/lib/sound';

interface CompletionProps {
  onExit: () => void;
}

export default function Completion({ onExit }: CompletionProps) {
  const [session, setSession] = useState<GameSessionState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const state = await getGameState();
        if (!state) {
          onExit();
          return;
        }
        setSession(state);
        if (state.round_status === 'COMPLETED') {
          sounds.playSuccess();
        } else if (state.round_status === 'FAILED') {
          sounds.playError();
        }
      } catch (err) {
        console.error('Error fetching completion state:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [onExit]);

  const handleExit = () => {
    sounds.playClick();
    clearSessionToken();
    onExit();
  };

  if (loading) {
    return (
      <div className="min-h-screen cyber-grid scanlines flex items-center justify-center relative">
        <ArcaneCanvas />
        <Loader2 size={36} className="animate-spin text-[#10b981] mx-auto relative z-10" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen cyber-grid scanlines flex items-center justify-center relative">
        <ArcaneCanvas />
        <div className="text-center font-mono relative z-10">
          <p className="text-gray-400 mb-4">No completed session found in Nemesis records.</p>
          <button onClick={handleExit} className="cyber-btn text-sm">
            Return to Gates
          </button>
        </div>
      </div>
    );
  }

  const isSuccess = session.round_status === 'COMPLETED';

  const elapsedSeconds = session.time_taken_seconds ?? (
    session.started_at && session.completed_at
      ? Math.round((new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 1000)
      : null
  );

  const formatTime = (seconds: number | null) => {
    if (seconds === null || seconds === undefined) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isTimedOut = (elapsedSeconds !== null && elapsedSeconds >= 900) || session.timed_out;

  return (
    <div className="min-h-screen cyber-grid scanlines flex flex-col items-center justify-center px-4 py-12 relative animate-fade-in text-gray-200">
      <ArcaneCanvas />

      <div className="max-w-2xl w-full relative z-10">
        <div
          className={`terminal-panel p-6 sm:p-10 border-t-2 shadow-[0_0_60px_rgba(0,0,0,0.85)] text-center ${
            isSuccess ? 'border-t-[#10b981]' : 'border-t-red-500'
          }`}
        >
          {/* Doom Mask Emblem */}
          <div className="flex justify-center mb-4">
            <DoomMask size={80} glow={isSuccess} withRunes={true} />
          </div>

          {/* Outcome Status Tag */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 mb-4 rounded-full border text-xs font-mono tracking-widest uppercase">
            {isSuccess ? (
              <span className="text-[#10b981] border-[#10b981]/40 bg-[#10b981]/10 flex items-center gap-1.5 px-3 py-1 rounded-full">
                <CheckCircle2 size={13} /> ROUND 1 // FLAG CAPTURED
              </span>
            ) : isTimedOut ? (
              <span className="text-red-400 border-red-500/40 bg-red-950/20 flex items-center gap-1.5 px-3 py-1 rounded-full">
                <Clock size={13} /> ROUND 1 // TIME-OUT (15:00 EXHAUSTED)
              </span>
            ) : (
              <span className="text-red-400 border-red-500/40 bg-red-950/20 flex items-center gap-1.5 px-3 py-1 rounded-full">
                <XCircle size={13} /> ROUND 1 // EXHAUSTED / FAILED
              </span>
            )}
          </div>

          {/* Title */}
          <h1
            className={`font-regal text-3xl sm:text-5xl font-black mb-2 tracking-wider ${
              isSuccess ? 'text-[#10b981]' : 'text-red-400'
            }`}
          >
            {isSuccess ? 'DOMAIN IDENTIFIED' : isTimedOut ? 'TIME LIMIT EXHAUSTED' : 'TRIAL EXHAUSTED'}
          </h1>
          <div className="h-0.5 w-48 mx-auto bg-gradient-to-r from-transparent via-[#f59e0b] to-transparent mb-6" />

          {/* Timeout Alert Banner */}
          {isTimedOut && (
            <div className="p-3 mb-6 rounded bg-red-950/40 border border-red-500/50 text-red-300 text-xs font-mono flex items-center justify-center gap-2">
              <Clock size={15} className="text-red-400 shrink-0" />
              <span>15-minute countdown expired. Round automatically submitted by system.</span>
            </div>
          )}

          {/* Revealed Domain Box */}
          <div className="p-4 rounded bg-black/60 border border-[#f59e0b]/40 mb-6 font-mono">
            <div className="text-[11px] text-gray-400 uppercase tracking-widest mb-1">
              ASSIGNED HIDDEN DOMAIN
            </div>
            <div className="text-xl sm:text-2xl text-[#f59e0b] font-bold tracking-wider">
              {session.assigned_domain_name || 'UNRESOLVED DOMAIN'}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-left mb-6">
            <div className="p-3 bg-black/40 border border-gray-800 rounded">
              <div className="text-[10px] text-gray-500 uppercase">FINAL SCORE</div>
              <div className="text-lg font-bold text-[#10b981]">{session.score} PTS</div>
            </div>

            <div className="p-3 bg-black/40 border border-gray-800 rounded">
              <div className="text-[10px] text-gray-500 uppercase">TIME TAKEN</div>
              <div className="text-lg font-bold text-cyan-400">
                {formatTime(elapsedSeconds)} <span className="text-[10px] text-gray-500 font-normal">/ 15:00</span>
              </div>
            </div>

            <div className="p-3 bg-black/40 border border-gray-800 rounded">
              <div className="text-[10px] text-gray-500 uppercase">CLUES REVEALED</div>
              <div className="text-lg font-bold text-[#f59e0b]">{session.current_clue} / 15</div>
            </div>

            <div className="p-3 bg-black/40 border border-gray-800 rounded">
              <div className="text-[10px] text-gray-500 uppercase">WRONG GUESSES</div>
              <div className="text-lg font-bold text-red-400">{session.wrong_guess_count}</div>
            </div>
          </div>

          {/* Participant Information */}
          <div className="p-3 rounded bg-black/30 border border-gray-800/80 text-xs font-mono text-gray-400 text-left mb-6 space-y-1">
            <div>
              <span className="text-gray-500">Participant:</span>{' '}
              <strong className="text-gray-200">{session.participant_name}</strong>{' '}
              <span className="text-gray-500">[RRN: {session.participant_id}]</span>
            </div>
            {session.started_at && (
              <div>
                <span className="text-gray-500">Started:</span>{' '}
                <span className="text-gray-300">{new Date(session.started_at).toLocaleString()}</span>
              </div>
            )}
            {session.completed_at && (
              <div>
                <span className="text-gray-500">Concluded:</span>{' '}
                <span className="text-gray-300">{new Date(session.completed_at).toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Exit Action */}
          <button
            onClick={handleExit}
            onMouseEnter={() => sounds.playHover()}
            className="cyber-btn text-xs px-8 py-2.5 mx-auto flex items-center justify-center gap-2"
          >
            <span>Return to Gates</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
