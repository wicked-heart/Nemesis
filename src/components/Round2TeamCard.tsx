import { useState, useEffect, useCallback } from 'react';
import {
  Users2,
  Award,
  Link2,
  RefreshCw,
  CheckCircle2,
  Clock,
  Shield,
  Sparkles,
  Zap,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';
import { getPlayerTeamInfo, getBroadcastMessage } from '@/lib/api';
import type { PlayerTeamInfo } from '@/lib/types';
import { DEFAULT_SECRET_DIRECTIVE } from '@/lib/types';
import { renderClassifiedContent } from '@/lib/directiveRenderer';
import DoomMask from './DoomMask';
import { sounds } from '@/lib/sound';

interface Round2TeamCardProps {
  initialTeam?: PlayerTeamInfo | null;
  currentParticipantName?: string;
  currentParticipantId?: string;
  currentScore?: number;
  className?: string;
}

export default function Round2TeamCard({
  initialTeam,
  currentParticipantName,
  currentParticipantId,
  currentScore,
  className = '',
}: Round2TeamCardProps) {
  const [team, setTeam] = useState<PlayerTeamInfo | null>(initialTeam ?? null);
  const [loading, setLoading] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date>(new Date());
  
  // Stealth reveal state: owner can hover or tap to decrypt, keeping it concealed from bystanders
  const [isDirectivePinned, setIsDirectivePinned] = useState(false);
  const [isDirectiveHovered, setIsDirectiveHovered] = useState(false);

  const isDirectiveVisible = isDirectivePinned || isDirectiveHovered;

  const fetchTeam = useCallback(async (playAudio = false) => {
    try {
      if (playAudio) sounds.playClick();
      setLoading(true);
      
      let teamData = await getPlayerTeamInfo();

      // Ensure broadcast message status is synced in real-time
      try {
        const broadcast = await getBroadcastMessage();
        if (broadcast) {
          if (teamData) {
            teamData = {
              ...teamData,
              broadcast_revealed: broadcast.is_revealed,
              broadcast_message: broadcast.message,
            };
          } else {
            teamData = {
              is_assigned: false,
              broadcast_revealed: broadcast.is_revealed,
              broadcast_message: broadcast.message,
            };
          }
        }
      } catch (bErr) {
        console.error('Error fetching broadcast message:', bErr);
      }

      if (teamData) {
        setTeam(teamData);
        setLastSynced(new Date());
        if (playAudio && teamData.is_assigned) {
          sounds.playSuccess();
        }
      }
    } catch (err) {
      console.error('Failed to fetch player team info:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync when initialTeam changes and always sync broadcast status
  useEffect(() => {
    if (initialTeam) {
      setTeam(initialTeam);
    }
    fetchTeam();
  }, [initialTeam, fetchTeam]);

  // Periodic polling every 4 seconds to catch when admin reveals or hides broadcast live
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTeam(false);
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchTeam]);

  // Stealth Directive Box (Concealed / Privacy Blurred to shoulder-surfers, readable to laptop owner on hover/tap)
  const renderStealthDirective = () => {
    if (!team?.broadcast_revealed) return null;

    return (
      <div
        onClick={() => {
          sounds.playClick();
          setIsDirectivePinned((prev) => !prev);
        }}
        onMouseEnter={() => setIsDirectiveHovered(true)}
        onMouseLeave={() => setIsDirectiveHovered(false)}
        className={`p-4 sm:p-5 rounded-2xl border transition-all duration-300 text-left cursor-pointer select-none relative overflow-hidden group ${
          isDirectiveVisible
            ? 'bg-black/80 border-zinc-700 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.95)]'
            : 'bg-black/50 border-zinc-800 hover:border-zinc-700'
        }`}
        title="Classified Directive — Hover or tap to decrypt"
      >
        {/* Stealth Header */}
        <div className="flex items-center justify-between gap-2 pb-2.5 mb-3 border-b border-zinc-800 text-[10px]">
          <div className="flex items-center gap-1.5">
            <Lock size={11} className={isDirectiveVisible ? 'text-zinc-300' : 'text-zinc-600'} />
            <span className="font-mono uppercase tracking-[0.16em] text-zinc-400 font-medium">
              CLASSIFIED DIRECTIVE // EYES ONLY
            </span>
          </div>

          <div className="flex items-center gap-1 text-[9px] font-mono transition-colors">
            {isDirectiveVisible ? (
              <span className="text-zinc-300 flex items-center gap-1 font-medium">
                <Eye size={10} className="text-emerald-500/80" />
                <span>DECRYPTED (TAP TO CONCEAL)</span>
              </span>
            ) : (
              <span className="text-zinc-500 flex items-center gap-1 group-hover:text-zinc-300">
                <EyeOff size={10} />
                <span>CONCEALED (HOVER / TAP TO READ)</span>
              </span>
            )}
          </div>
        </div>

        {/* Message Payload with Privacy Blur for nearby viewers */}
        <div className="relative py-1">
          <div
            className={`transition-all duration-300 ${
              isDirectiveVisible
                ? 'filter-none opacity-100'
                : 'blur-[3.5px] opacity-20 pointer-events-none'
            }`}
          >
            {renderClassifiedContent(
              !team.broadcast_message ||
              team.broadcast_message.includes('help doom catch cheaters') ||
              !team.broadcast_message.includes('OPERATION DOOM')
                ? DEFAULT_SECRET_DIRECTIVE
                : team.broadcast_message
            )}
          </div>

          {/* Privacy Overlay Prompt when concealed */}
          {!isDirectiveVisible && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="chip text-zinc-300 border-zinc-700 bg-black/90">
                [HOVER OR TAP TO DECRYPT]
              </span>
            </div>
          )}
        </div>

        {/* Stealth Discreet Footer */}
        <div className="flex items-center justify-between text-[9px] text-zinc-500 pt-2.5 mt-3 border-t border-zinc-800/80 font-mono">
          <span>Source: Sovereign Arbiter Channel</span>
          {isDirectiveVisible ? (
            <span className="text-zinc-300 font-medium tracking-wider animate-fade-in flex items-center gap-1">
              <span className="text-doom-glow/90 font-bold">+8 PTS</span>
              <span>BOUNTY REWARD</span>
            </span>
          ) : (
            <span className="text-zinc-600 italic">Status: Encrypted</span>
          )}
        </div>
      </div>
    );
  };

  // State 0: Round 2 has not been authorized yet by Admin
  if (!team || team.is_round2_active === false) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="terminal-panel p-5 sm:p-6 text-center space-y-4 relative overflow-hidden animate-fade-in border border-doom-line bg-black/60">
          <div className="flex flex-col items-center gap-3">
            <div className="w-11 h-11 rounded-full grid place-items-center border border-doom-line bg-white/[0.03] text-gray-500">
              <Lock size={18} />
            </div>
            <span className="font-mono text-[11px] font-bold tracking-[0.18em] text-gray-400">
              ROUND 2 // TACTICAL SYNDICATE [LOCKED]
            </span>
          </div>

          <p className="text-gray-400 text-[13px] max-w-lg mx-auto leading-relaxed">
            Round 2 has not commenced. Team dossiers and tactical directives remain strictly sealed until authorized by the Sovereign Admin.
          </p>

          <div className="glass px-4 py-2 font-mono text-[10px] text-gray-500 max-w-xs mx-auto">
            <span>STATUS: AWAITING SOVEREIGN AUTHORIZATION</span>
          </div>
        </div>
      </div>
    );
  }

  // State A: Player is assigned to a Round 2 Team
  if (team && team.is_assigned) {
    const isP1 = team.is_player1 ?? true;
    const you = team.you ?? (isP1 ? team.player1 : team.player2);
    const teammate = team.teammate ?? (isP1 ? team.player2 : team.player1);
    const totalScore = team.total_score ?? ((you?.score || 0) + (teammate?.score || 0));

    return (
      <div className={`space-y-3 ${className}`}>
        <div className="terminal-panel p-5 sm:p-6 relative overflow-hidden animate-fade-in">
          <div aria-hidden className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(34,197,94,0.1),transparent_70%)]" />

          {/* Header Bar */}
          <div className="relative flex flex-wrap items-start justify-between gap-3 pb-4 mb-5 border-b border-doom-line">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 shrink-0 rounded-xl grid place-items-center bg-doom-green/10 border border-doom-green/30 text-doom-glow">
                <Users2 size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-mono text-[10px] font-bold tracking-[0.16em] text-doom-glow">
                    ROUND 2 SQUAD #{String(team.team_number ?? 1).padStart(2, '0')}
                  </span>
                  <span className="font-mono text-[10px] text-gray-400 flex items-center gap-1">
                    <CheckCircle2 size={11} className="text-doom-green" /> SYNCHRONIZED
                  </span>
                </div>
                <h3 className="font-regal text-lg text-gray-50 font-bold tracking-wide mt-0.5 truncate">
                  {team.team_name}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchTeam(true)}
                disabled={loading}
                className="chip text-gray-400 hover:text-doom-glow hover:border-doom-green/40 transition-colors"
                title="Refresh team dossier"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin text-doom-glow' : ''} />
                <span className="hidden sm:inline">Sync</span>
              </button>
            </div>
          </div>

          {/* Combined Score Highlight */}
          <div className="relative text-center mb-5">
            <div className="font-mono text-[10px] text-gray-500 uppercase tracking-[0.2em] mb-1">
              TOTAL SYNDICATE SCORE (P1 + P2)
            </div>
            <div className="font-regal text-5xl font-black text-gray-50 drop-shadow-[0_0_24px_rgba(34,197,94,0.35)]">
              {totalScore} <span className="font-mono text-sm font-normal text-doom-glow tracking-[0.2em]">PTS</span>
            </div>
            <div className="font-mono text-[11px] text-gray-500 mt-2 flex items-center justify-center gap-3">
              <span>Your R1: <strong className="text-doom-glow">{you?.score ?? 0} pts</strong></span>
              <span>&bull;</span>
              <span>Partner R1: <strong className="text-doom-glow">{teammate?.score ?? 0} pts</strong></span>
            </div>
          </div>

          {/* Member Details: linked operative cards */}
          <div className="relative grid grid-cols-1 gap-0">
            {/* Card 1: YOU */}
            <div className="glass !border-doom-green/40 !bg-doom-green/[0.06] p-4 text-left space-y-1.5">
              <div className="flex items-center justify-between font-mono text-[10px]">
                <span className="font-bold tracking-[0.14em] text-doom-glow">
                  YOU [{isP1 ? 'PLAYER 1' : 'PLAYER 2'}]
                </span>
                <span className="text-doom-green font-bold tracking-[0.14em]">ACTIVE</span>
              </div>
              <div className="text-[15px] font-semibold text-gray-50 truncate">
                {you?.name || currentParticipantName || 'You'}
              </div>
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-gray-500">
                  RRN: <strong className="text-gray-300 font-medium">{you?.participant_id || currentParticipantId}</strong>
                </span>
                <span className="text-doom-glow font-bold">
                  {you?.score ?? currentScore ?? 0} PTS
                </span>
              </div>
            </div>

            {/* Center Connector */}
            <div className="flex justify-center -my-1.5 relative z-10">
              <div className="w-9 h-9 rounded-full grid place-items-center border border-doom-green/50 bg-doom-iron text-doom-glow shadow-[0_0_18px_-2px_rgba(34,197,94,0.6)]">
                <Link2 size={15} />
              </div>
            </div>

            {/* Card 2: TEAMMATE */}
            <div className="glass p-4 text-left space-y-1.5">
              <div className="flex items-center justify-between font-mono text-[10px]">
                <span className="font-bold tracking-[0.14em] text-gray-300">
                  PARTNER [{isP1 ? 'PLAYER 2' : 'PLAYER 1'}]
                </span>
                <span className="text-cyan-400 font-bold tracking-[0.14em]">LINKED</span>
              </div>
              <div className="text-[15px] font-semibold text-gray-50 truncate">
                {teammate?.name || 'Awaiting Partner'}
              </div>
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-gray-500">
                  RRN: <strong className="text-gray-300 font-medium">{teammate?.participant_id || '---'}</strong>
                </span>
                <span className="text-doom-glow font-bold">
                  {teammate?.score ?? 0} PTS
                </span>
              </div>
            </div>
          </div>

          {/* Footer Subtext */}
          <div className="relative flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-gray-500 mt-5 pt-4 border-t border-doom-line">
            <span className="flex items-center gap-1 text-doom-green">
              <Zap size={11} /> Round 2 Syndicate Established by Arbiter
            </span>
            <span>Last Synced: {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
        </div>

        {/* --- REVEALED CLASSIFIED DIRECTIVE: STEALTH PRIVACY DISPLAY --- */}
        {renderStealthDirective()}
      </div>
    );
  }

  // State B: Player is awaiting team pairing by Admin
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="terminal-panel p-5 sm:p-6 text-center space-y-4 relative overflow-hidden animate-fade-in">
        <div className="flex flex-col items-center gap-3">
          <div className="w-11 h-11 rounded-full grid place-items-center border border-doom-steel/30 bg-white/[0.03] text-doom-steel">
            <Clock size={18} className="animate-pulse" />
          </div>
          <span className="font-mono text-[11px] font-bold tracking-[0.18em] text-gray-200">ROUND 2 // SQUAD PAIRING IN PROGRESS</span>
        </div>

        <p className="text-gray-400 text-[13px] max-w-lg mx-auto leading-relaxed">
          The Arbiter is currently organizing participants into <strong className="text-gray-200">teams of 2</strong> for Round 2.
          Once your team is formed, your partner's name, RRN, individual score, and combined score will manifest automatically below.
        </p>

        {/* Your current profile preview */}
        <div className="glass px-4 py-3 font-mono text-[11px] text-left space-y-1.5 max-w-sm mx-auto">
          <div className="flex justify-between gap-3">
            <span className="text-gray-500">OPERATIVE: </span>
            <strong className="text-gray-100 truncate">{currentParticipantName || team?.participant_name || 'You'}</strong>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-gray-500">RRN: </span>
            <strong className="text-gray-300">{currentParticipantId || team?.participant_id || '---'}</strong>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-gray-500">R1 SCORE: </span>
            <strong className="text-doom-glow">{currentScore ?? 0} PTS</strong>
          </div>
        </div>

        <div className="pt-1 flex items-center justify-center gap-2">
          <button
            onClick={() => fetchTeam(true)}
            disabled={loading}
            className="cyber-btn cyber-btn-cyan text-xs px-4 py-2 flex items-center gap-1.5 mx-auto"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Checking Registry...' : 'Check Team Pairing Status'}</span>
          </button>
        </div>
      </div>

      {/* --- REVEALED CLASSIFIED DIRECTIVE: STEALTH PRIVACY DISPLAY --- */}
      {renderStealthDirective()}
    </div>
  );
}
