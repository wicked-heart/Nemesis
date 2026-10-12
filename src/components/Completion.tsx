import { useState, useEffect } from 'react';
import { Award, CheckCircle2, XCircle, Loader2, Target, Calendar, AlertTriangle, ArrowRight, Clock } from 'lucide-react';
import { getGameState, clearSessionToken } from '@/lib/api';
import type { GameSessionState } from '@/lib/types';
import Backdrop from './backdrop/Backdrop';
import Doom3D from './doom3d/Doom3D';
import Round2TeamCard from './Round2TeamCard';
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
        <Backdrop />
        <Loader2 size={36} className="animate-spin text-doom-green mx-auto relative z-10" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen cyber-grid scanlines flex items-center justify-center relative px-4">
        <Backdrop />
        <div className="terminal-panel p-8 max-w-sm w-full text-center relative z-10">
          <p className="text-gray-400 text-sm mb-6">No completed session found in Nemesis records.</p>
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
    <div className="min-h-screen cyber-grid scanlines flex flex-col items-center px-4 py-12 sm:py-16 relative animate-fade-in text-gray-200">
      <Backdrop />

      <div className="max-w-2xl w-full relative z-10">
        {/* --- Doom's verdict --- */}
        <div className="text-center">
          {/* Doom Mask Emblem */}
          <div className="flex justify-center mb-2">
            <Doom3D
              mode={isSuccess ? 'win' : 'lose'}
              className={`doom-stage relative w-64 h-72 sm:w-72 sm:h-80 ${isSuccess ? 'is-win' : 'is-dim'}`}
            />
          </div>

          {/* Outcome Status Tag */}
          <div className="inline-flex items-center mb-5">
            {isSuccess ? (
              <span className="chip border-doom-green/40 bg-doom-green/10 text-doom-glow">
                <CheckCircle2 size={13} /> ROUND 1 // FLAG CAPTURED
              </span>
            ) : isTimedOut ? (
              <span className="chip border-red-500/40 bg-red-950/40 text-red-300">
                <Clock size={13} /> ROUND 1 // TIME-OUT (15:00 EXHAUSTED)
              </span>
            ) : (
              <span className="chip border-red-500/40 bg-red-950/40 text-red-300">
                <XCircle size={13} /> ROUND 1 // EXHAUSTED / FAILED
              </span>
            )}
          </div>

          {/* Title */}
          <h1
            className={`display text-[clamp(2.4rem,8vw,4.5rem)] ${
              isSuccess ? 'wordmark' : '!text-red-300 drop-shadow-[0_0_30px_rgba(239,68,68,0.35)]'
            }`}
          >
            {isSuccess ? 'DOMAIN IDENTIFIED' : isTimedOut ? 'TIME LIMIT EXHAUSTED' : 'TRIAL EXHAUSTED'}
          </h1>
          <div className={`hairline w-56 mx-auto mt-6 mb-8 ${isSuccess ? '' : 'bg-gradient-to-r from-transparent via-red-500/60 to-transparent'}`} />
        </div>

        {/* Timeout Alert Banner */}
        {isTimedOut && (
          <div className="px-4 py-3 mb-6 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs font-mono flex items-center justify-center gap-2 text-center">
            <Clock size={15} className="text-red-400 shrink-0" />
            <span>15-minute countdown expired. Round automatically submitted by system.</span>
          </div>
        )}

        {/* Revealed Domain Box */}
        <div className="terminal-panel p-6 sm:p-8 mb-4 text-center">
          <div className="font-mono text-[10px] text-gray-500 uppercase tracking-[0.24em] mb-2">
            ASSIGNED HIDDEN DOMAIN
          </div>
          <div className="font-regal text-3xl sm:text-4xl text-gray-50 font-bold tracking-wide">
            {session.assigned_domain_name || 'UNRESOLVED DOMAIN'}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left mb-4">
          <div className="doom-feature-card p-4 sm:p-5">
            <div className="font-mono text-[10px] text-gray-500 uppercase tracking-[0.16em]">FINAL SCORE</div>
            <div className="font-mono text-2xl font-bold text-doom-glow mt-2">{session.score} <span className="text-xs text-gray-500">PTS</span></div>
          </div>

          <div className="doom-feature-card p-4 sm:p-5">
            <div className="font-mono text-[10px] text-gray-500 uppercase tracking-[0.16em]">TIME TAKEN</div>
            <div className="font-mono text-xl sm:text-2xl font-bold text-gray-50 mt-2 tabular-nums whitespace-nowrap">
              {formatTime(elapsedSeconds)} <span className="text-[10px] text-gray-500 font-normal">/ 15:00</span>
            </div>
          </div>

          <div className="doom-feature-card p-4 sm:p-5">
            <div className="font-mono text-[10px] text-gray-500 uppercase tracking-[0.16em]">CLUES REVEALED</div>
            <div className="font-mono text-2xl font-bold text-gray-50 mt-2">{session.current_clue} / 15</div>
          </div>

          <div className="doom-feature-card p-4 sm:p-5">
            <div className="font-mono text-[10px] text-gray-500 uppercase tracking-[0.16em]">WRONG GUESSES</div>
            <div className="font-mono text-2xl font-bold text-red-400 mt-2">{session.wrong_guess_count}</div>
          </div>
        </div>

        {/* Participant Information */}
        <div className="glass px-5 py-4 text-xs font-mono text-gray-400 text-left mb-8 space-y-1.5">
          <div>
            <span className="text-gray-500">Participant:</span>{' '}
            <strong className="text-gray-100">{session.participant_name}</strong>{' '}
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

        {/* Round 2 Tactical Syndicate Dossier */}
        <div className="mb-10 text-left">
          <Round2TeamCard
            initialTeam={session.team}
            currentParticipantName={session.participant_name}
            currentParticipantId={session.participant_id}
            currentScore={session.score}
          />
        </div>

        {/* Exit Action */}
        <button
          onClick={handleExit}
          onMouseEnter={() => sounds.playHover()}
          className="cyber-btn cyber-btn-cyan text-sm px-8 py-3 mx-auto flex items-center justify-center gap-2"
        >
          <span>Return to Gates</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
