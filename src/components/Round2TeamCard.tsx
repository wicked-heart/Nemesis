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
        className={`p-3 sm:p-4 rounded-lg border transition-all text-left cursor-pointer select-none relative overflow-hidden group ${
          isDirectiveVisible
            ? 'bg-[#030504] border-zinc-800 shadow-[0_4px_30px_rgba(0,0,0,0.95)]'
            : 'bg-[#020503]/80 border-zinc-900 hover:border-zinc-800'
        }`}
        title="Classified Directive — Hover or tap to decrypt"
      >
        {/* Stealth Header */}
        <div className="flex items-center justify-between gap-2 pb-1.5 mb-2 border-b border-zinc-900 text-[10px]">
          <div className="flex items-center gap-1.5">
            <Lock size={11} className={isDirectiveVisible ? 'text-zinc-400' : 'text-zinc-600'} />
            <span className="font-mono uppercase tracking-wider text-zinc-500 font-medium">
              CLASSIFIED DIRECTIVE // EYES ONLY
            </span>
          </div>

          <div className="flex items-center gap-1 text-[9px] font-mono transition-colors">
            {isDirectiveVisible ? (
              <span className="text-zinc-400 flex items-center gap-1 font-medium">
                <Eye size={10} className="text-emerald-500/80" />
                <span>DECRYPTED (TAP TO CONCEAL)</span>
              </span>
            ) : (
              <span className="text-zinc-600 flex items-center gap-1 group-hover:text-zinc-400">
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
              <span className="text-[10px] text-zinc-400 bg-black/95 px-2.5 py-1 rounded border border-zinc-800 tracking-wider font-mono shadow">
                [HOVER OR TAP TO DECRYPT]
              </span>
            </div>
          )}
        </div>

        {/* Stealth Discreet Footer */}
        <div className="flex items-center justify-between text-[9px] text-zinc-600 pt-1.5 mt-2 border-t border-zinc-900/80 font-mono">
          <span>Source: Sovereign Arbiter Channel</span>
          {isDirectiveVisible ? (
            <span className="text-zinc-400 font-medium tracking-wider animate-fade-in flex items-center gap-1">
              <span className="text-amber-400/90 font-bold">+8 PTS</span>
              <span>BOUNTY REWARD</span>
            </span>
          ) : (
            <span className="text-zinc-700 italic">Status: Encrypted</span>
          )}
        </div>
      </div>
    );
  };

  // State A: Player is assigned to a Round 2 Team
  if (team && team.is_assigned) {
    const isP1 = team.is_player1 ?? true;
    const you = team.you ?? (isP1 ? team.player1 : team.player2);
    const teammate = team.teammate ?? (isP1 ? team.player2 : team.player1);
    const totalScore = team.total_score ?? ((you?.score || 0) + (teammate?.score || 0));

    return (
      <div className={`space-y-3 font-mono ${className}`}>
        <div className="terminal-panel p-5 sm:p-6 border-2 border-cyan-500/50 rounded-lg shadow-[0_0_35px_rgba(6,182,212,0.15)] text-xs relative overflow-hidden animate-fade-in">
          {/* Top Arcane Glow Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 mb-4 border-b border-gray-800">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded bg-cyan-500/20 border border-cyan-400/40 text-cyan-300">
                <Users2 size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400 text-cyan-300 text-[10px] font-bold">
                    ROUND 2 SQUAD #{String(team.team_number ?? 1).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 size={11} /> SYNCHRONIZED
                  </span>
                </div>
                <h3 className="font-regal text-base sm:text-lg text-gray-100 font-bold tracking-wider mt-0.5">
                  {team.team_name}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchTeam(true)}
                disabled={loading}
                className="text-gray-400 hover:text-cyan-300 transition-colors p-1.5 rounded border border-gray-800 hover:border-cyan-500/40 bg-black/40 flex items-center gap-1 text-[11px]"
                title="Refresh team dossier"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin text-cyan-400' : ''} />
                <span className="hidden sm:inline">Sync</span>
              </button>
            </div>
          </div>

          {/* Combined Score Highlight */}
          <div className="p-4 rounded-lg bg-black/60 border border-cyan-500/30 mb-4 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-950/20 via-emerald-950/20 to-cyan-950/20 pointer-events-none" />
            <div className="text-[11px] text-gray-400 uppercase tracking-widest mb-0.5">
              TOTAL SYNDICATE SCORE (P1 + P2)
            </div>
            <div className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-emerald-300 to-amber-300 tracking-wider">
              {totalScore} <span className="text-sm font-normal text-gray-400">PTS</span>
            </div>
            <div className="text-[11px] text-gray-500 mt-1 flex items-center justify-center gap-3">
              <span>Your R1: <strong className="text-amber-400">{you?.score ?? 0} pts</strong></span>
              <span>&bull;</span>
              <span>Partner R1: <strong className="text-amber-400">{teammate?.score ?? 0} pts</strong></span>
            </div>
          </div>

          {/* Member Details: Side-by-side Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-11 items-center gap-2.5">
            {/* Card 1: YOU */}
            <div className="sm:col-span-5 p-3.5 rounded-lg border border-cyan-500/60 bg-cyan-950/30 text-left space-y-1 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
              <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40">
                  YOU [{isP1 ? 'PLAYER 1' : 'PLAYER 2'}]
                </span>
                <span className="text-emerald-400 font-bold">ACTIVE</span>
              </div>
              <div className="text-sm font-bold text-gray-100 truncate">
                {you?.name || currentParticipantName || 'You'}
              </div>
              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="text-gray-400">
                  RRN: <strong className="text-[#10b981]">{you?.participant_id || currentParticipantId}</strong>
                </span>
                <span className="text-amber-400 font-bold">
                  {you?.score ?? currentScore ?? 0} PTS
                </span>
              </div>
            </div>

            {/* Center Connector */}
            <div className="sm:col-span-1 flex justify-center py-1">
              <div className="p-2 rounded-full border border-cyan-400/60 bg-cyan-500/20 text-cyan-300 animate-pulse">
                <Link2 size={16} />
              </div>
            </div>

            {/* Card 2: TEAMMATE */}
            <div className="sm:col-span-5 p-3.5 rounded-lg border border-emerald-500/60 bg-emerald-950/30 text-left space-y-1 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                  PARTNER [{isP1 ? 'PLAYER 2' : 'PLAYER 1'}]
                </span>
                <span className="text-emerald-400 font-bold">LINKED</span>
              </div>
              <div className="text-sm font-bold text-gray-100 truncate">
                {teammate?.name || 'Awaiting Partner'}
              </div>
              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="text-gray-400">
                  RRN: <strong className="text-[#10b981]">{teammate?.participant_id || '---'}</strong>
                </span>
                <span className="text-amber-400 font-bold">
                  {teammate?.score ?? 0} PTS
                </span>
              </div>
            </div>
          </div>

          {/* Footer Subtext */}
          <div className="flex items-center justify-between text-[10px] text-gray-500 mt-4 pt-2.5 border-t border-gray-800/80">
            <span className="flex items-center gap-1 text-cyan-400">
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
    <div className={`space-y-3 font-mono ${className}`}>
      <div className="terminal-panel p-5 border border-dashed border-gray-700/80 rounded-lg bg-black/40 text-xs text-center space-y-3 relative overflow-hidden animate-fade-in">
        <div className="flex items-center justify-center gap-2 text-amber-400 text-xs font-bold tracking-wider">
          <Clock size={15} className="animate-pulse" />
          <span>ROUND 2 // SQUAD PAIRING IN PROGRESS</span>
        </div>

        <p className="text-gray-400 text-[11px] max-w-lg mx-auto leading-relaxed">
          The Arbiter is currently organizing participants into <strong>teams of 2</strong> for Round 2.
          Once your team is formed, your partner's name, RRN, individual score, and combined score will manifest automatically below.
        </p>

        {/* Your current profile preview */}
        <div className="inline-flex items-center gap-4 px-4 py-2 rounded bg-black/60 border border-gray-800 text-[11px]">
          <div>
            <span className="text-gray-500">OPERATIVE: </span>
            <strong className="text-gray-200">{currentParticipantName || team?.participant_name || 'You'}</strong>
          </div>
          <div>
            <span className="text-gray-500">RRN: </span>
            <strong className="text-[#10b981]">{currentParticipantId || team?.participant_id || '---'}</strong>
          </div>
          <div>
            <span className="text-gray-500">R1 SCORE: </span>
            <strong className="text-amber-400">{currentScore ?? 0} PTS</strong>
          </div>
        </div>

        <div className="pt-1 flex items-center justify-center gap-2">
          <button
            onClick={() => fetchTeam(true)}
            disabled={loading}
            className="cyber-btn cyber-btn-cyan text-[11px] px-3 py-1 flex items-center gap-1.5 mx-auto"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Checking Registry...' : 'Check Team Pairing Status'}</span>
          </button>
        </div>
      </div>

      {/* --- REVEALED CLASSIFIED DIRECTIVE: STEALTH PRIVACY DISPLAY --- */}
      {renderStealthDirective()}
    </div>
  );
}
