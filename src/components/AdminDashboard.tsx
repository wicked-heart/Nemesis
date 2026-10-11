import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  CheckCircle2,
  Activity,
  Trophy,
  AlertTriangle,
  RefreshCw,
  Eye,
  LogOut,
  Loader2,
  X,
  Search,
  Filter,
  ShieldAlert,
  Clock,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Award,
  Download,
  Users2,
  UserPlus,
  Trash2,
  Link2,
  CheckSquare,
  Square,
  Layers,
  ArrowRight,
  UserCheck,
  Megaphone,
  EyeOff,
} from 'lucide-react';
import {
  getAdminDashboard,
  getAdminParticipantDetails,
  resolvePenalty,
  getRound2Teams,
  createRound2Team,
  disbandRound2Team,
  revealBroadcastMessage,
} from '@/lib/api';
import type {
  AdminDashboardData,
  AdminParticipantRow,
  AdminParticipantDetail,
  RoundStatus,
  PlayerStatus,
  Round2TeamsData,
  Round2TeamItem,
  Round2PlayerSummary,
} from '@/lib/types';
import { DEFAULT_SECRET_DIRECTIVE } from '@/lib/types';
import { renderClassifiedContent } from '@/lib/directiveRenderer';
import DoomMask from './DoomMask';
import ArcaneCanvas from './ArcaneCanvas';
import { sounds } from '@/lib/sound';

interface AdminDashboardProps {
  password: string;
  onLogout: () => void;
}

export default function AdminDashboard({ password, onLogout }: AdminDashboardProps) {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authError, setAuthError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roundFilter, setRoundFilter] = useState<'ALL' | RoundStatus>('ALL');
  const [playerFilter, setPlayerFilter] = useState<'ALL' | PlayerStatus>('ALL');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<AdminParticipantDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshCountdown, setRefreshCountdown] = useState(8);
  const [activeTab, setActiveTab] = useState<'overview' | 'scoreboard' | 'teams'>('overview');
  const [scoreSearchQuery, setScoreSearchQuery] = useState('');

  // Round 2 Team Formation States
  const [teamsData, setTeamsData] = useState<Round2TeamsData | null>(null);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [customTeamName, setCustomTeamName] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [disbandingId, setDisbandingId] = useState<string | null>(null);
  const [unassignedSearchQuery, setUnassignedSearchQuery] = useState('');
  const [teamsSearchQuery, setTeamsSearchQuery] = useState('');
  const [teamFeedback, setTeamFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await getAdminDashboard(password);
      if (res.error === 'unauthorized') {
        setAuthError(true);
        return;
      }
      setData(res);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  }, [password]);

  const loadTeamsData = useCallback(async () => {
    setTeamsLoading(true);
    try {
      const res = await getRound2Teams(password);
      if (res.error) {
        setTeamFeedback({ type: 'error', message: res.error });
      } else {
        setTeamsData(res);
      }
    } catch (err) {
      setTeamFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to fetch Round 2 teams data',
      });
    } finally {
      setTeamsLoading(false);
    }
  }, [password]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Load Round 2 teams whenever switching to the teams tab
  useEffect(() => {
    if (activeTab === 'teams') {
      loadTeamsData();
    }
  }, [activeTab, loadTeamsData]);

  // Auto-refresh timer (every 8 seconds)
  useEffect(() => {
    if (!autoRefresh) {
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }

    setRefreshCountdown(8);
    countdownRef.current = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          loadDashboard();
          if (activeTab === 'teams') {
            loadTeamsData();
          }
          return 8;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [autoRefresh, loadDashboard, activeTab, loadTeamsData]);

  // Round 2 Handlers
  const handleTogglePlayerSelection = (playerId: string) => {
    sounds.playClick();
    setTeamFeedback(null);
    setSelectedPlayerIds((prev) => {
      if (prev.includes(playerId)) {
        return prev.filter((id) => id !== playerId);
      }
      if (prev.length >= 2) {
        // If 2 already picked, replace the second one
        return [prev[0], playerId];
      }
      return [...prev, playerId];
    });
  };

  const handleCreateTeam = async () => {
    if (selectedPlayerIds.length !== 2) {
      setTeamFeedback({ type: 'error', message: 'Select exactly 2 operatives to form a pair.' });
      return;
    }
    sounds.playClick();
    setCreatingTeam(true);
    setTeamFeedback(null);
    try {
      const res = await createRound2Team(
        password,
        selectedPlayerIds[0],
        selectedPlayerIds[1],
        customTeamName
      );
      if (res.error) {
        setTeamFeedback({ type: 'error', message: res.error });
      } else {
        setTeamFeedback({
          type: 'success',
          message: `Team "${res.team_name || 'Team #' + res.team_number}" successfully established!`,
        });
        setSelectedPlayerIds([]);
        setCustomTeamName('');
        await loadTeamsData();
      }
    } catch (err) {
      setTeamFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to create team',
      });
    } finally {
      setCreatingTeam(false);
    }
  };

  const handleDisbandTeam = async (teamId: string, teamName: string) => {
    if (!window.confirm(`Disband "${teamName}"? Both operatives will return to the unassigned pool.`)) {
      return;
    }
    sounds.playClick();
    setDisbandingId(teamId);
    setTeamFeedback(null);
    try {
      const res = await disbandRound2Team(password, teamId);
      if (res.error) {
        setTeamFeedback({ type: 'error', message: res.error });
      } else {
        setTeamFeedback({
          type: 'success',
          message: `Team "${teamName}" disbanded. Operatives returned to unassigned pool.`,
        });
        await loadTeamsData();
      }
    } catch (err) {
      setTeamFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to disband team',
      });
    } finally {
      setDisbandingId(null);
    }
  };

  const handleToggleBroadcast = async () => {
    sounds.playClick();
    setBroadcasting(true);
    setTeamFeedback(null);
    const willReveal = !teamsData?.broadcast_revealed;

    // Optimistically toggle so button flips immediately
    setTeamsData((prev) => (prev ? { ...prev, broadcast_revealed: willReveal } : prev));

    try {
      const res = await revealBroadcastMessage(password, willReveal);
      if (res.error) {
        setTeamsData((prev) => (prev ? { ...prev, broadcast_revealed: !willReveal } : prev));
        setTeamFeedback({ type: 'error', message: res.error });
      } else {
        sounds.playSuccess();
        setTeamFeedback({
          type: 'success',
          message: willReveal
            ? 'Broadcast message revealed to all players!'
            : 'Broadcast message hidden from players.',
        });
        await loadTeamsData();
      }
    } catch (err) {
      setTeamsData((prev) => (prev ? { ...prev, broadcast_revealed: !willReveal } : prev));
      setTeamFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update broadcast status',
      });
    } finally {
      setBroadcasting(false);
    }
  };

  const handleOpenDetail = async (sessionId: string) => {
    sounds.playClick();
    setSelectedSessionId(sessionId);
    setDetailLoading(true);
    try {
      const details = await getAdminParticipantDetails(password, sessionId);
      if (details.error === 'unauthorized') {
        setAuthError(true);
        return;
      }
      setDetailData(details);
    } catch (err) {
      console.error('Failed to load participant details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedSessionId(null);
    setDetailData(null);
  };

  const handleResolvePenalty = async (sessionId: string) => {
    sounds.playClick();
    setResolvingId(sessionId);
    try {
      const res = await resolvePenalty(password, sessionId);
      if (res.error) {
        alert(`Error resolving penalty: ${res.error}`);
        return;
      }
      sounds.playSuccess();
      await loadDashboard();
      if (selectedSessionId === sessionId) {
        const details = await getAdminParticipantDetails(password, sessionId);
        setDetailData(details);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to resolve penalty');
    } finally {
      setResolvingId(null);
    }
  };

  if (authError) {
    return (
      <div className="min-h-screen cyber-grid scanlines flex items-center justify-center px-4">
        <div className="terminal-panel p-8 max-w-md text-center font-mono">
          <X className="text-red-400 mx-auto mb-4" size={32} />
          <p className="text-red-400 text-sm mb-4">Authentication failed. Invalid sovereign credentials.</p>
          <button onClick={onLogout} className="cyber-btn text-xs">
            Back to Gate
          </button>
        </div>
      </div>
    );
  }

  // Filter participants
  const participants = data?.participants || [];
  const filteredParticipants = participants.filter((p) => {
    const matchesSearch =
      searchQuery === '' ||
      p.participant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.participant_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.assigned_domain_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRound = roundFilter === 'ALL' || p.round_status === roundFilter;
    const matchesPlayer = playerFilter === 'ALL' || p.player_status === playerFilter;

    return matchesSearch && matchesRound && matchesPlayer;
  });

  const formatAdminTime = (seconds?: number | null) => {
    if (seconds === null || seconds === undefined) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Scoreboard ranking: strictly sort by score descending, then time taken ascending, then wrong guesses ascending
  const scoreboardList = [...participants]
    .filter((p) => {
      if (!scoreSearchQuery) return true;
      const q = scoreSearchQuery.toLowerCase();
      return (
        p.participant_name.toLowerCase().includes(q) ||
        p.participant_id.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aTime = a.time_taken_seconds ?? 999999;
      const bTime = b.time_taken_seconds ?? 999999;
      if (aTime !== bTime) return aTime - bTime;
      return a.wrong_guess_count - b.wrong_guess_count;
    });

  const handleExportScores = () => {
    sounds.playClick();
    const headers = ['Rank', 'Name', 'RRN', 'Score', 'Time Taken', 'Wrong Guesses', 'Round Status'];
    const rows = scoreboardList.map((p, idx) => [
      idx + 1,
      `"${p.participant_name.replace(/"/g, '""')}"`,
      `"${p.participant_id.replace(/"/g, '""')}"`,
      p.score,
      `"${formatAdminTime(p.time_taken_seconds)}"`,
      p.wrong_guess_count,
      p.round_status,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `nemesis_round1_scores_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen cyber-grid scanlines text-gray-200 flex flex-col justify-between selection:bg-[#10b981] selection:text-black">
      <ArcaneCanvas />

      {/* --- Top Admin Command Bar --- */}
      <header className="relative z-20 border-b border-gray-800/80 bg-[#020704]/90 backdrop-blur-md px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-3">
            <DoomMask size={24} glow={true} withRunes={false} />
            <span className="text-[#f59e0b] font-bold tracking-widest uppercase">
              NEMESIS // ADMIN SUPERVISORY CONSOLE
            </span>
            <span className="text-gray-700">|</span>
            <span className="text-[#10b981]">ROUND 1: FIND THE FLAG</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] transition-colors ${
                autoRefresh
                  ? 'border-[#10b981]/50 text-[#10b981] bg-black/40'
                  : 'border-gray-800 text-gray-500 bg-black/20'
              }`}
            >
              <RefreshCw size={11} className={autoRefresh ? 'animate-spin' : ''} />
              <span>{autoRefresh ? `AUTO-REFRESH (${refreshCountdown}s)` : 'AUTO-REFRESH OFF'}</span>
            </button>

            <button
              onClick={() => {
                sounds.playClick();
                loadDashboard();
              }}
              className="cyber-btn cyber-btn-cyan text-[11px] px-2.5 py-1 flex items-center gap-1"
            >
              <RefreshCw size={11} /> Refresh
            </button>

            <button
              onClick={onLogout}
              className="flex items-center gap-1 text-gray-500 hover:text-red-400 transition-colors text-[11px]"
            >
              <LogOut size={12} /> Exit
            </button>
          </div>
        </div>
      </header>

      {/* --- Main Admin Content --- */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 py-6 space-y-6">
        {/* KPI Stat Cards */}
        {data?.stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono">
            <div className="doom-feature-card p-4 rounded text-left">
              <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
                <span>TOTAL PLAYERS</span>
                <Users size={14} className="text-[#10b981]" />
              </div>
              <div className="text-2xl font-bold text-gray-100">{data.stats.total_players}</div>
            </div>

            <div className="doom-feature-card p-4 rounded text-left">
              <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
                <span>ACTIVE ROUNDS</span>
                <Activity size={14} className="text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-[#10b981]">{data.stats.active_players}</div>
            </div>

            <div className="doom-feature-card p-4 rounded text-left">
              <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
                <span>COMPLETED</span>
                <CheckCircle2 size={14} className="text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-blue-400">{data.stats.completed_players}</div>
            </div>

            <div className="doom-feature-card p-4 rounded text-left">
              <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
                <span>EXHAUSTED / FAILED</span>
                <AlertTriangle size={14} className="text-red-400" />
              </div>
              <div className="text-2xl font-bold text-red-400">{data.stats.failed_players}</div>
            </div>

            <div className="doom-feature-card p-4 rounded text-left border-[#f59e0b]/40">
              <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
                <span>PENALTY PENDING</span>
                <ShieldAlert size={14} className="text-[#f59e0b]" />
              </div>
              <div className="text-2xl font-bold text-[#f59e0b]">
                {data.stats.penalty_pending_count}
              </div>
            </div>
          </div>
        )}

        {/* Section Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-800 pb-3 font-mono text-xs">
          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('overview');
            }}
            className={`px-4 py-2 rounded flex items-center gap-2 font-bold tracking-wider transition-all ${
              activeTab === 'overview'
                ? 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                : 'text-gray-400 hover:text-gray-200 border border-transparent hover:border-gray-800 bg-black/30'
            }`}
          >
            <Users size={14} />
            <span>PARTICIPANT OVERVIEW &amp; CONTROLS ({filteredParticipants.length})</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('scoreboard');
            }}
            className={`px-4 py-2 rounded flex items-center gap-2 font-bold tracking-wider transition-all ${
              activeTab === 'scoreboard'
                ? 'bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                : 'text-gray-400 hover:text-gray-200 border border-transparent hover:border-gray-800 bg-black/30'
            }`}
          >
            <Trophy size={14} className="text-[#f59e0b]" />
            <span>SCORE SECTION (NAME, RRN &amp; SCORES) ({scoreboardList.length})</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('teams');
            }}
            className={`px-4 py-2 rounded flex items-center gap-2 font-bold tracking-wider transition-all ${
              activeTab === 'teams'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                : 'text-gray-400 hover:text-gray-200 border border-transparent hover:border-gray-800 bg-black/30'
            }`}
          >
            <Users2 size={14} className="text-cyan-400" />
            <span>ROUND 2 TEAMS (PAIRS OF 2) {teamsData ? `(${teamsData.teams.length})` : ''}</span>
          </button>
        </div>

        {/* VIEW 1: Full Participant Overview & Operations */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            {/* Filters and Search Bar */}
            <div className="terminal-panel p-4 border border-gray-800 rounded flex flex-col md:flex-row gap-3 items-center justify-between font-mono text-xs">
              {/* Search */}
              <div className="relative w-full md:w-80">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, RRN, or domain..."
                  className="cyber-input pl-9 text-xs py-1.5"
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500">Round:</span>
                  <select
                    value={roundFilter}
                    onChange={(e) => setRoundFilter(e.target.value as any)}
                    className="bg-black/60 border border-gray-800 text-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-[#10b981]"
                  >
                    <option value="ALL">All Rounds</option>
                    <option value="NOT_STARTED">Not Started</option>
                    <option value="ACTIVE">Active</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="FAILED">Failed</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500">Player:</span>
                  <select
                    value={playerFilter}
                    onChange={(e) => setPlayerFilter(e.target.value as any)}
                    className="bg-black/60 border border-gray-800 text-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-[#10b981]"
                  >
                    <option value="ALL">All Players</option>
                    <option value="NORMAL">Normal</option>
                    <option value="PENALTY_PENDING">Penalty Pending</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Participant Table */}
            <div className="terminal-panel border border-gray-800 rounded overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)]">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-gray-800 bg-[#020704]/90 text-gray-400 uppercase text-[11px] tracking-wider">
                      <th className="py-3 px-3">Participant / RRN</th>
                      <th className="py-3 px-3">Assigned Domain</th>
                      <th className="py-3 px-2 text-center">Round Status</th>
                      <th className="py-3 px-2 text-center">Player Status</th>
                      <th className="py-3 px-2 text-center">Clue Progress</th>
                      <th className="py-3 px-2 text-center">Attempts Used</th>
                      <th className="py-3 px-2 text-center">Score</th>
                      <th className="py-3 px-3">Started</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center">
                          <Loader2 size={24} className="animate-spin text-[#10b981] mx-auto mb-2" />
                          <span className="text-gray-500">Retrieving participant records...</span>
                        </td>
                      </tr>
                    ) : filteredParticipants.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-gray-500">
                          No participants match current filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredParticipants.map((p) => {
                        const isPending = p.player_status === 'PENALTY_PENDING';
                        return (
                          <tr
                            key={p.session_id}
                            className={`hover:bg-white/[0.02] transition-colors ${
                              isPending ? 'bg-amber-950/10' : ''
                            }`}
                          >
                            {/* Name & RRN */}
                            <td className="py-3 px-3">
                              <div className="font-bold text-gray-200">{p.participant_name}</div>
                              <div className="text-[10px] text-gray-500">RRN: {p.participant_id}</div>
                            </td>

                            {/* Assigned Domain */}
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded bg-black/50 border border-[#f59e0b]/30 text-[#f59e0b] font-semibold text-[11px]">
                                {p.assigned_domain_name}
                              </span>
                            </td>

                            {/* Round Status */}
                            <td className="py-3 px-2 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  p.round_status === 'ACTIVE'
                                    ? 'bg-emerald-950/70 text-[#10b981] border border-emerald-500/40'
                                    : p.round_status === 'COMPLETED'
                                    ? 'bg-blue-950/70 text-blue-400 border border-blue-500/40'
                                    : p.round_status === 'FAILED'
                                    ? 'bg-red-950/70 text-red-400 border border-red-500/40'
                                    : 'bg-gray-900 text-gray-400 border border-gray-700'
                                }`}
                              >
                                {p.round_status}
                              </span>
                            </td>

                            {/* Player Status */}
                            <td className="py-3 px-2 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                                  isPending
                                    ? 'bg-amber-950/80 text-[#f59e0b] border border-amber-500/50 animate-pulse'
                                    : 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30'
                                }`}
                              >
                                {isPending && <AlertTriangle size={10} />}
                                {isPending ? 'PENALTY PENDING' : 'NORMAL'}
                              </span>
                            </td>

                            {/* Current Clue */}
                            <td className="py-3 px-2 text-center font-bold text-gray-300">
                              {p.current_clue > 0 ? `${p.current_clue} / 15` : '-'}
                            </td>

                            {/* Wrong Guesses / Attempts Used */}
                            <td className="py-3 px-2 text-center">
                              <span
                                className={`font-bold ${
                                  p.wrong_guess_count > 0 ? 'text-red-400' : 'text-gray-500'
                                }`}
                              >
                                {p.wrong_guess_count} / 15
                              </span>
                            </td>

                            {/* Score */}
                            <td className="py-3 px-2 text-center">
                              <span className="font-bold text-[#f59e0b]">{p.score}</span>
                            </td>

                            {/* Started */}
                            <td className="py-3 px-3 text-gray-400 text-[11px]">
                              {p.started_at ? new Date(p.started_at).toLocaleTimeString() : '-'}
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {isPending && (
                                  <button
                                    onClick={() => handleResolvePenalty(p.session_id)}
                                    disabled={resolvingId === p.session_id}
                                    className="px-2 py-1 rounded bg-amber-500/10 border border-amber-500/50 text-[#f59e0b] hover:bg-amber-500/20 text-[10px] font-bold transition-colors flex items-center gap-1"
                                    title={
                                      p.current_clue < 15
                                        ? `Unlock player and automatically advance to Clue ${p.current_clue + 1}`
                                        : 'Unlock player and conclude round (15 attempts exhausted)'
                                    }
                                  >
                                    {resolvingId === p.session_id ? (
                                      <Loader2 size={10} className="animate-spin" />
                                    ) : (
                                      <ShieldCheck size={11} />
                                    )}
                                    <span>
                                      {p.current_clue < 15
                                        ? `Unlock \u2192 Clue ${p.current_clue + 1}`
                                        : 'Unlock & Conclude (15/15)'}
                                    </span>
                                  </button>
                                )}

                                <button
                                  onClick={() => handleOpenDetail(p.session_id)}
                                  className="px-2 py-1 rounded bg-black/60 border border-gray-700 text-gray-300 hover:border-[#10b981] hover:text-[#10b981] text-[10px] transition-colors flex items-center gap-1"
                                >
                                  <Eye size={11} /> Inspect
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: Dedicated Score Section (Name, RRN, Score Only) */}
        {activeTab === 'scoreboard' && (
          <div className="space-y-4 animate-fade-in font-mono">
            {/* Scoreboard Toolbar */}
            <div className="terminal-panel p-4 border border-gray-800 rounded flex flex-col md:flex-row gap-3 items-center justify-between text-xs">
              {/* Search */}
              <div className="relative w-full md:w-80">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={scoreSearchQuery}
                  onChange={(e) => setScoreSearchQuery(e.target.value)}
                  placeholder="Search name or RRN..."
                  className="cyber-input pl-9 text-xs py-1.5"
                />
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                <div className="text-gray-400 text-xs">
                  Showing <span className="text-[#f59e0b] font-bold">{scoreboardList.length}</span> ranked participants
                </div>
                <button
                  onClick={handleExportScores}
                  className="cyber-btn cyber-btn-cyan text-xs px-3 py-1.5 flex items-center gap-1.5"
                  title="Export scoreboard as CSV"
                >
                  <Download size={13} />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Clean Scoreboard Table: Rank, Name, RRN, Time Taken, Score */}
            <div className="terminal-panel border border-gray-800 rounded overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)]">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-800 bg-[#020704]/90 text-gray-400 uppercase text-[11px] tracking-wider">
                      <th className="py-3.5 px-4 w-24 text-center">Rank</th>
                      <th className="py-3.5 px-6">Name</th>
                      <th className="py-3.5 px-6">Registered Roll Number (RRN)</th>
                      <th className="py-3.5 px-4 text-center">Time Taken</th>
                      <th className="py-3.5 px-6 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center">
                          <Loader2 size={24} className="animate-spin text-[#10b981] mx-auto mb-2" />
                          <span className="text-gray-500">Compiling scores...</span>
                        </td>
                      </tr>
                    ) : scoreboardList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-gray-500">
                          No participant score records found.
                        </td>
                      </tr>
                    ) : (
                      scoreboardList.map((p, index) => {
                        const rank = index + 1;
                        const isTop1 = rank === 1 && p.score > 0;
                        const isTop2 = rank === 2 && p.score > 0;
                        const isTop3 = rank === 3 && p.score > 0;

                        return (
                          <tr
                            key={p.session_id}
                            className={`hover:bg-white/[0.02] transition-colors ${
                              isTop1
                                ? 'bg-amber-950/20'
                                : isTop2
                                ? 'bg-slate-900/30'
                                : isTop3
                                ? 'bg-amber-950/10'
                                : ''
                            }`}
                          >
                            {/* Rank */}
                            <td className="py-3.5 px-4 text-center">
                              {isTop1 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/50 text-[#f59e0b] font-bold text-xs shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                                  <Trophy size={11} className="text-[#f59e0b]" /> #1
                                </span>
                              ) : isTop2 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-400/20 border border-gray-400/50 text-gray-200 font-bold text-xs">
                                  #2
                                </span>
                              ) : isTop3 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-700/20 border border-amber-700/50 text-amber-500 font-bold text-xs">
                                  #3
                                </span>
                              ) : (
                                <span className="text-gray-500 font-semibold">#{rank}</span>
                              )}
                            </td>

                            {/* Participant Name */}
                            <td className="py-3.5 px-6">
                              <span className="font-bold text-sm text-gray-100 tracking-wide">
                                {p.participant_name}
                              </span>
                            </td>

                            {/* Registered Roll Number (RRN) */}
                            <td className="py-3.5 px-6">
                              <span className="px-2.5 py-1 rounded bg-black/60 border border-gray-800 text-[#10b981] font-bold text-xs tracking-wider">
                                {p.participant_id}
                              </span>
                            </td>

                            {/* Time Taken */}
                            <td className="py-3.5 px-4 text-center">
                              <span className="px-2.5 py-1 rounded bg-black/40 border border-gray-800 font-mono text-cyan-400 font-semibold text-xs tracking-wider">
                                {formatAdminTime(p.time_taken_seconds)}
                              </span>
                            </td>

                            {/* Score */}
                            <td className="py-3.5 px-6 text-right">
                              <span
                                className={`text-base font-black tracking-wider ${
                                  p.score > 0
                                    ? 'text-[#10b981] drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                                    : 'text-gray-500'
                                }`}
                              >
                                {p.score} <span className="text-xs font-normal text-gray-400">PTS</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: Round 2 Manual Team Formation (Pairs of 2) */}
        {activeTab === 'teams' && (
          <div className="space-y-6 animate-fade-in font-mono">
            {/* Feedback Alert Banner */}
            {teamFeedback && (
              <div
                className={`p-3.5 rounded border flex items-center justify-between text-xs transition-all ${
                  teamFeedback.type === 'success'
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                    : 'bg-red-950/40 border-red-500/50 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.15)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  {teamFeedback.type === 'success' ? (
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle size={16} className="text-red-400 shrink-0" />
                  )}
                  <span>{teamFeedback.message}</span>
                </div>
                <button
                  onClick={() => setTeamFeedback(null)}
                  className="text-gray-400 hover:text-white p-1"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Round 2 Team Stats KPI Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="doom-feature-card p-4 rounded text-left border-cyan-500/30">
                <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
                  <span>TOTAL REGISTERED</span>
                  <Users size={14} className="text-cyan-400" />
                </div>
                <div className="text-2xl font-bold text-gray-100">
                  {teamsData?.stats.total_players ?? (loading ? '...' : 0)}
                </div>
                <div className="text-[10px] text-gray-500 mt-1">Total in tournament</div>
              </div>

              <div className="doom-feature-card p-4 rounded text-left border-emerald-500/30">
                <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
                  <span>FORMED TEAMS</span>
                  <Users2 size={14} className="text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-emerald-400">
                  {teamsData?.stats.formed_teams_count ?? 0}
                </div>
                <div className="text-[10px] text-gray-500 mt-1">Pairs of 2 established</div>
              </div>

              <div className="doom-feature-card p-4 rounded text-left border-blue-500/30">
                <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
                  <span>ASSIGNED OPERATIVES</span>
                  <UserCheck size={14} className="text-blue-400" />
                </div>
                <div className="text-2xl font-bold text-blue-400">
                  {teamsData?.stats.assigned_players_count ?? 0}
                </div>
                <div className="text-[10px] text-gray-500 mt-1">Currently in a team</div>
              </div>

              <div className="doom-feature-card p-4 rounded text-left border-amber-500/40">
                <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
                  <span>UNASSIGNED POOL</span>
                  <UserPlus size={14} className="text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-amber-400">
                  {teamsData?.stats.unassigned_players_count ?? 0}
                </div>
                <div className="text-[10px] text-gray-500 mt-1">Awaiting pair pairing</div>
              </div>
            </div>

            {/* Main Interactive Grid: Formation Terminal (Left) & Formed Teams Roster (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* LEFT COLUMN: Pairing Dock & Operatives Selection */}
              <div className="lg:col-span-6 space-y-4">
                {/* 1. Interactive Pairing Dock */}
                <div className="terminal-panel p-5 border-2 border-cyan-500/40 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.1)] relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-cyan-500/20 text-cyan-300 text-[10px] px-2.5 py-0.5 rounded-bl font-bold border-b border-l border-cyan-500/30">
                    MANUAL PAIRING TERMINAL
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <UserPlus size={16} className="text-cyan-400" />
                    <h3 className="font-regal text-base text-gray-100 font-bold tracking-wider">
                      FORM A TEAM OF 2
                    </h3>
                  </div>
                  <p className="text-[11px] text-gray-400 mb-4 leading-relaxed">
                    Select 2 unassigned operatives from the pool below to establish a syndicate team.
                  </p>

                  {/* 2 Operative Slots */}
                  {(() => {
                    const unassignedList = teamsData?.unassigned_players || [];
                    const p1 = unassignedList.find((p) => p.id === selectedPlayerIds[0]);
                    const p2 = unassignedList.find((p) => p.id === selectedPlayerIds[1]);
                    const combinedScore = (p1?.round1_score || 0) + (p2?.round1_score || 0);

                    return (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-11 items-center gap-2">
                          {/* Slot 1 */}
                          <div
                            className={`sm:col-span-5 p-3 rounded border transition-all ${
                              p1
                                ? 'bg-cyan-950/40 border-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                                : 'bg-black/40 border-dashed border-gray-700 text-gray-500'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                              <span className="font-bold text-cyan-400">OPERATIVE #1</span>
                              {p1 && (
                                <button
                                  onClick={() => handleTogglePlayerSelection(p1.id)}
                                  className="text-gray-400 hover:text-red-400 p-0.5"
                                  title="Remove selection"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                            {p1 ? (
                              <div>
                                <div className="font-bold text-sm text-gray-100 truncate">
                                  {p1.name}
                                </div>
                                <div className="flex items-center justify-between text-[10px] mt-1">
                                  <span className="text-[#10b981] font-mono">{p1.participant_id}</span>
                                  <span className="text-amber-400 font-bold">R1: {p1.round1_score} pts</span>
                                </div>
                              </div>
                            ) : (
                              <div className="text-[11px] italic py-2 text-center text-gray-600">
                                Click an operative below to select
                              </div>
                            )}
                          </div>

                          {/* Link Connector */}
                          <div className="sm:col-span-1 flex justify-center py-1">
                            <div
                              className={`p-1.5 rounded-full border transition-all ${
                                p1 && p2
                                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 animate-pulse'
                                  : 'bg-black/40 border-gray-800 text-gray-600'
                              }`}
                            >
                              <Link2 size={14} />
                            </div>
                          </div>

                          {/* Slot 2 */}
                          <div
                            className={`sm:col-span-5 p-3 rounded border transition-all ${
                              p2
                                ? 'bg-cyan-950/40 border-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                                : 'bg-black/40 border-dashed border-gray-700 text-gray-500'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                              <span className="font-bold text-cyan-400">OPERATIVE #2</span>
                              {p2 && (
                                <button
                                  onClick={() => handleTogglePlayerSelection(p2.id)}
                                  className="text-gray-400 hover:text-red-400 p-0.5"
                                  title="Remove selection"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                            {p2 ? (
                              <div>
                                <div className="font-bold text-sm text-gray-100 truncate">
                                  {p2.name}
                                </div>
                                <div className="flex items-center justify-between text-[10px] mt-1">
                                  <span className="text-[#10b981] font-mono">{p2.participant_id}</span>
                                  <span className="text-amber-400 font-bold">R1: {p2.round1_score} pts</span>
                                </div>
                              </div>
                            ) : (
                              <div className="text-[11px] italic py-2 text-center text-gray-600">
                                Click an operative below to select
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Optional Custom Team Name & Action */}
                        <div className="pt-2 border-t border-gray-800/80 space-y-3">
                          <div>
                            <label className="block text-[11px] text-gray-400 mb-1">
                              TEAM NAME <span className="text-gray-600">(OPTIONAL)</span>
                            </label>
                            <input
                              type="text"
                              value={customTeamName}
                              onChange={(e) => setCustomTeamName(e.target.value)}
                              placeholder={`Default: Team #${String((teamsData?.teams.length || 0) + 1).padStart(2, '0')}`}
                              maxLength={50}
                              className="cyber-input text-xs py-1.5 w-full"
                              disabled={creatingTeam}
                            />
                          </div>

                          {/* Stats Preview & Create Button */}
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                            <div className="text-[11px] text-gray-400">
                              {p1 && p2 ? (
                                <span className="text-cyan-300">
                                  Combined Round 1 Score: <strong className="text-amber-400 font-bold">{combinedScore} PTS</strong>
                                </span>
                              ) : (
                                <span>{selectedPlayerIds.length}/2 operatives picked</span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              {selectedPlayerIds.length > 0 && (
                                <button
                                  onClick={() => setSelectedPlayerIds([])}
                                  className="text-gray-500 hover:text-gray-300 text-xs px-2 py-1.5"
                                  disabled={creatingTeam}
                                >
                                  Clear
                                </button>
                              )}
                              <button
                                onClick={handleCreateTeam}
                                disabled={selectedPlayerIds.length !== 2 || creatingTeam}
                                className={`flex-1 sm:flex-initial cyber-btn text-xs px-4 py-2 flex items-center justify-center gap-2 ${
                                  selectedPlayerIds.length === 2 && !creatingTeam
                                    ? 'cyber-btn-cyan shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                                    : 'opacity-50 cursor-not-allowed bg-gray-900 border-gray-800 text-gray-500'
                                }`}
                              >
                                {creatingTeam ? (
                                  <>
                                    <Loader2 size={13} className="animate-spin text-cyan-400" />
                                    <span>CREATING TEAM...</span>
                                  </>
                                ) : (
                                  <>
                                    <Sparkles size={13} className="text-cyan-400" />
                                    <span>ESTABLISH TEAM PAIR</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* 2. Unassigned Operatives Pool List */}
                <div className="terminal-panel border border-gray-800 rounded-lg overflow-hidden">
                  <div className="p-3 bg-[#020704]/90 border-b border-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <UserPlus size={14} className="text-amber-400" />
                      <span className="font-bold text-xs text-gray-200">
                        AVAILABLE UNASSIGNED OPERATIVES ({teamsData?.unassigned_players.length ?? 0})
                      </span>
                    </div>

                    {/* Search unassigned */}
                    <div className="relative w-full sm:w-48">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input
                        type="text"
                        value={unassignedSearchQuery}
                        onChange={(e) => setUnassignedSearchQuery(e.target.value)}
                        placeholder="Search pool..."
                        className="cyber-input pl-7 text-[11px] py-1 w-full"
                      />
                    </div>
                  </div>

                  <div className="p-2 max-h-[460px] overflow-y-auto space-y-1.5 divide-y divide-gray-900/40">
                    {teamsLoading && !teamsData ? (
                      <div className="py-12 text-center text-gray-500">
                        <Loader2 size={20} className="animate-spin text-cyan-400 mx-auto mb-2" />
                        <span>Loading operatives pool...</span>
                      </div>
                    ) : (() => {
                      const unassignedList = teamsData?.unassigned_players || [];
                      const filtered = unassignedList.filter((p) => {
                        if (!unassignedSearchQuery) return true;
                        const q = unassignedSearchQuery.toLowerCase();
                        return (
                          p.name.toLowerCase().includes(q) ||
                          p.participant_id.toLowerCase().includes(q)
                        );
                      });

                      if (unassignedList.length === 0) {
                        return (
                          <div className="py-12 text-center text-gray-500 text-xs">
                            <CheckCircle2 size={28} className="text-emerald-400 mx-auto mb-2 opacity-80" />
                            <p className="text-gray-300 font-bold mb-1">ALL OPERATIVES ARE PAIRED!</p>
                            <p className="text-gray-500 text-[11px]">
                              There are currently no unassigned operatives remaining.
                            </p>
                          </div>
                        );
                      }

                      if (filtered.length === 0) {
                        return (
                          <div className="py-8 text-center text-gray-500 text-xs">
                            No operatives matched "{unassignedSearchQuery}".
                          </div>
                        );
                      }

                      return filtered.map((player) => {
                        const isSelected = selectedPlayerIds.includes(player.id);
                        return (
                          <div
                            key={player.id}
                            onClick={() => handleTogglePlayerSelection(player.id)}
                            className={`p-2.5 rounded border cursor-pointer transition-all flex items-center justify-between text-xs ${
                              isSelected
                                ? 'bg-cyan-950/40 border-cyan-500/70 shadow-[0_0_12px_rgba(6,182,212,0.15)] text-gray-100'
                                : 'bg-black/30 border-gray-800/80 hover:border-gray-700 hover:bg-black/50 text-gray-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="text-cyan-400">
                                {isSelected ? (
                                  <CheckSquare size={16} className="text-cyan-400" />
                                ) : (
                                  <Square size={16} className="text-gray-600" />
                                )}
                              </div>
                              <div>
                                <div className="font-bold text-gray-200 tracking-wide">
                                  {player.name}
                                </div>
                                <div className="text-[11px] text-gray-500 font-mono">
                                  RRN: <span className="text-[#10b981]">{player.participant_id}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <span className="text-[10px] text-gray-500 block uppercase">Round 1</span>
                                <span className="font-bold text-amber-400 text-xs">
                                  {player.round1_score} PTS
                                </span>
                              </div>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded border uppercase font-bold ${
                                  isSelected
                                    ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300'
                                    : 'bg-black/40 border-gray-800 text-gray-500'
                                }`}
                              >
                                {isSelected ? 'SELECTED' : 'SELECT'}
                              </span>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Formed Teams Roster */}
              <div className="lg:col-span-6 space-y-4">
                <div className="terminal-panel border border-gray-800 rounded-lg overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.6)]">
                  {/* Formed Teams Header */}
                  <div className="p-3.5 bg-[#020704]/90 border-b border-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Users2 size={16} className="text-emerald-400" />
                      <div>
                        <span className="font-bold text-xs text-gray-200 block">
                          FORMED ROUND 2 TEAMS ({teamsData?.teams.length ?? 0})
                        </span>
                        <span className="text-[10px] text-gray-500">
                          Syndicates paired &amp; ready for Round 2
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      {/* Search formed teams */}
                      <div className="relative flex-1 sm:w-44">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                          type="text"
                          value={teamsSearchQuery}
                          onChange={(e) => setTeamsSearchQuery(e.target.value)}
                          placeholder="Search teams..."
                          className="cyber-input pl-7 text-[11px] py-1 w-full"
                        />
                      </div>

                      <button
                        onClick={loadTeamsData}
                        className="cyber-btn cyber-btn-cyan text-[11px] px-2.5 py-1 flex items-center gap-1 shrink-0"
                        title="Reload teams"
                      >
                        <RefreshCw size={11} className={teamsLoading ? 'animate-spin' : ''} />
                      </button>
                    </div>
                  </div>

                  {/* Formed Teams List */}
                  <div className="p-3 max-h-[680px] overflow-y-auto space-y-3">
                    {teamsLoading && !teamsData ? (
                      <div className="py-16 text-center text-gray-500">
                        <Loader2 size={24} className="animate-spin text-emerald-400 mx-auto mb-2" />
                        <span>Loading team registry...</span>
                      </div>
                    ) : (() => {
                      const teamsList = teamsData?.teams || [];
                      const filteredTeams = teamsList.filter((team) => {
                        if (!teamsSearchQuery) return true;
                        const q = teamsSearchQuery.toLowerCase();
                        return (
                          team.team_name.toLowerCase().includes(q) ||
                          String(team.team_number).includes(q) ||
                          team.player1.name.toLowerCase().includes(q) ||
                          team.player1.participant_id.toLowerCase().includes(q) ||
                          team.player2.name.toLowerCase().includes(q) ||
                          team.player2.participant_id.toLowerCase().includes(q)
                        );
                      });

                      if (teamsList.length === 0) {
                        return (
                          <div className="py-16 text-center text-gray-500 text-xs">
                            <Layers size={32} className="text-gray-600 mx-auto mb-3 opacity-60" />
                            <p className="text-gray-300 font-bold mb-1">NO TEAMS ESTABLISHED YET</p>
                            <p className="text-gray-500 text-[11px] max-w-sm mx-auto">
                              Select 2 operatives from the pairing terminal on the left to form your first Round 2 team.
                            </p>
                          </div>
                        );
                      }

                      if (filteredTeams.length === 0) {
                        return (
                          <div className="py-10 text-center text-gray-500 text-xs">
                            No formed teams matched "{teamsSearchQuery}".
                          </div>
                        );
                      }

                      return filteredTeams.map((team) => {
                        const isDisbanding = disbandingId === team.id;
                        return (
                          <div
                            key={team.id}
                            className="p-3.5 rounded-lg border border-gray-800 bg-black/40 hover:border-gray-700 transition-all space-y-2.5"
                          >
                            {/* Card Top: Number, Name, Combined Score, Disband Action */}
                            <div className="flex items-center justify-between pb-2 border-b border-gray-800/80">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold">
                                  #{String(team.team_number).padStart(2, '0')}
                                </span>
                                <h4 className="font-bold text-sm text-gray-100 tracking-wide">
                                  {team.team_name}
                                </h4>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-[11px]">
                                  Combined: {team.combined_round1_score} PTS
                                </span>

                                <button
                                  onClick={() => handleDisbandTeam(team.id, team.team_name)}
                                  disabled={isDisbanding}
                                  className="text-gray-500 hover:text-red-400 p-1.5 rounded hover:bg-red-950/30 border border-transparent hover:border-red-900/50 transition-colors"
                                  title="Disband team and return players to pool"
                                >
                                  {isDisbanding ? (
                                    <Loader2 size={13} className="animate-spin text-red-400" />
                                  ) : (
                                    <Trash2 size={13} />
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Card Body: The 2 Paired Players */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              {/* Member 1 */}
                              <div className="p-2 rounded bg-black/60 border border-gray-800/80 flex items-center justify-between">
                                <div className="truncate pr-2">
                                  <span className="text-[10px] text-gray-500 block uppercase">Member 1</span>
                                  <span className="font-bold text-gray-200 truncate block">
                                    {team.player1.name}
                                  </span>
                                  <span className="text-[10px] text-[#10b981] font-mono">
                                    {team.player1.participant_id}
                                  </span>
                                </div>
                                <span className="text-amber-400 font-bold text-xs shrink-0">
                                  {team.player1.round1_score} pts
                                </span>
                              </div>

                              {/* Member 2 */}
                              <div className="p-2 rounded bg-black/60 border border-gray-800/80 flex items-center justify-between">
                                <div className="truncate pr-2">
                                  <span className="text-[10px] text-gray-500 block uppercase">Member 2</span>
                                  <span className="font-bold text-gray-200 truncate block">
                                    {team.player2.name}
                                  </span>
                                  <span className="text-[10px] text-[#10b981] font-mono">
                                    {team.player2.participant_id}
                                  </span>
                                </div>
                                <span className="text-amber-400 font-bold text-xs shrink-0">
                                  {team.player2.round1_score} pts
                                </span>
                              </div>
                            </div>

                            {/* Card Footer: Timestamp */}
                            <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1">
                              <span>Formed: {new Date(team.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                <CheckCircle2 size={10} /> Ready for Round 2
                              </span>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Directive Broadcast Control Panel */}
            <div className="terminal-panel p-5 border-2 border-[#f59e0b]/50 rounded-lg shadow-[0_0_30px_rgba(245,158,11,0.15)] bg-black/70 relative overflow-hidden">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-2 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <Megaphone size={16} className="text-[#f59e0b]" />
                    <span className="font-regal text-sm font-bold text-gray-100 tracking-wider">
                      BROADCAST DECREE // DOOM CHEATER BOUNTY DIRECTIVE
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold border uppercase tracking-wider ${
                        teamsData?.broadcast_revealed
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 animate-pulse'
                          : 'bg-gray-800 border-gray-700 text-gray-400'
                      }`}
                    >
                      {teamsData?.broadcast_revealed ? 'LIVE ON ALL PLAYER SCREENS' : 'CURRENTLY HIDDEN'}
                    </span>
                  </div>

                  <div className="p-3.5 rounded bg-black/90 border border-amber-500/30 text-xs font-mono leading-relaxed max-h-72 overflow-y-auto">
                    <span className="text-gray-500 block text-[10px] uppercase font-bold mb-2 pb-1 border-b border-gray-800 flex items-center justify-between">
                      <span>CLASSIFIED DIRECTIVE PAYLOAD</span>
                      <span className="text-amber-400">TARGET: PAID AI PLANS (+8 PTS)</span>
                    </span>
                    {renderClassifiedContent(
                      !teamsData?.broadcast_message ||
                      teamsData.broadcast_message.includes('help doom catch cheaters') ||
                      !teamsData.broadcast_message.includes('OPERATION DOOM')
                        ? DEFAULT_SECRET_DIRECTIVE
                        : teamsData.broadcast_message
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Clicking <strong>Reveal Message</strong> immediately broadcasts this classified directive below the team details across all active player screens.
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
                  <button
                    onClick={handleToggleBroadcast}
                    disabled={broadcasting}
                    className={`w-full md:w-auto cyber-btn text-xs px-6 py-3 flex items-center justify-center gap-2 font-bold tracking-wider ${
                      teamsData?.broadcast_revealed
                        ? 'bg-amber-950/60 border-amber-500/60 text-amber-300 hover:bg-red-950/40 hover:border-red-500/60 hover:text-red-300'
                        : 'cyber-btn-cyan shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                    }`}
                  >
                    {broadcasting ? (
                      <>
                        <Loader2 size={14} className="animate-spin text-[#f59e0b]" />
                        <span>TRANSMITTING DIRECTIVE...</span>
                      </>
                    ) : teamsData?.broadcast_revealed ? (
                      <>
                        <EyeOff size={14} />
                        <span>HIDE MESSAGE</span>
                      </>
                    ) : (
                      <>
                        <Megaphone size={14} className="text-cyan-400" />
                        <span>REVEAL MESSAGE</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- Detail Modal --- */}
      {selectedSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="terminal-panel max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto border-t-2 border-t-[#f59e0b]">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <DoomMask size={24} glow={true} withRunes={false} />
                <h3 className="font-regal text-lg text-[#f59e0b] font-bold tracking-wider">
                  PARTICIPANT DOSSIER // {detailData?.participant_name || 'LOADING...'}
                </h3>
              </div>
              <button
                onClick={handleCloseDetail}
                className="text-gray-500 hover:text-[#f59e0b] font-mono text-base"
              >
                [X]
              </button>
            </div>

            {detailLoading || !detailData ? (
              <div className="py-16 text-center">
                <Loader2 size={28} className="animate-spin text-[#f59e0b] mx-auto mb-2" />
                <p className="text-xs text-gray-400 font-mono">Decrypting participant dossier...</p>
              </div>
            ) : (
              <div className="space-y-6 font-mono text-xs">
                {/* Top Summary Header */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-black/40 p-3.5 rounded border border-gray-800">
                  <div>
                    <span className="text-gray-500 text-[10px] block">ASSIGNED DOMAIN</span>
                    <strong className="text-[#f59e0b] text-sm font-bold">
                      {detailData.assigned_domain_name}
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[10px] block">ROUND STATUS</span>
                    <strong className="text-gray-200">{detailData.round_status}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[10px] block">PLAYER STATUS</span>
                    <strong
                      className={
                        detailData.player_status === 'PENALTY_PENDING'
                          ? 'text-[#f59e0b]'
                          : 'text-emerald-400'
                      }
                    >
                      {detailData.player_status}
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[10px] block">SCORE / CLUE</span>
                    <strong className="text-[#10b981] text-sm font-bold">
                      {detailData.score} PTS &bull; Clue {detailData.current_clue}/15
                    </strong>
                  </div>
                </div>

                {/* Resolve Penalty Action in Modal if Pending */}
                {detailData.player_status === 'PENALTY_PENDING' && (
                  <div className="p-3.5 rounded bg-amber-950/40 border border-amber-500/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[#f59e0b]">
                      <AlertTriangle size={16} className="shrink-0" />
                      <span className="text-xs">
                        {detailData.current_clue < 15
                          ? `Outstanding penalty on Clue ${detailData.current_clue} (Attempt ${detailData.wrong_guess_count}/15). Resolving will unlock terminal and automatically advance player to Clue ${detailData.current_clue + 1}.`
                          : `Final attempt (15/15) penalty on Clue 15. Resolving will unlock terminal and conclude the round.`}
                      </span>
                    </div>
                    <button
                      onClick={() => handleResolvePenalty(detailData.session_id)}
                      disabled={resolvingId === detailData.session_id}
                      className="cyber-btn text-xs px-4 py-1.5 flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      {resolvingId === detailData.session_id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <ShieldCheck size={13} />
                      )}
                      <span>
                        {detailData.current_clue < 15
                          ? `Unlock \u2192 Clue ${detailData.current_clue + 1}`
                          : 'Unlock & Conclude Round'}
                      </span>
                    </button>
                  </div>
                )}

                {/* All 15 Clues for this Domain */}
                <div>
                  <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
                    <span className="text-[#10b981] font-bold tracking-wider flex items-center gap-1.5">
                      <Eye size={13} /> ALL 15 CLUES FOR "{detailData.assigned_domain_name}"
                    </span>
                    <span className="text-gray-500 text-[11px]">
                      {detailData.clues.filter((c) => c.unlocked).length} OF 15 UNLOCKED BY PLAYER
                    </span>
                  </div>

                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {detailData.clues.map((c) => (
                      <div
                        key={c.clue_number}
                        className={`p-2.5 rounded border text-[11px] ${
                          c.unlocked
                            ? 'bg-black/60 border-emerald-500/40 text-gray-200'
                            : 'bg-black/20 border-gray-800/60 text-gray-500'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-[#10b981]">
                            CLUE #{String(c.clue_number).padStart(2, '0')}
                          </span>
                          <span
                            className={`text-[10px] font-bold ${
                              c.unlocked ? 'text-emerald-400' : 'text-gray-600'
                            }`}
                          >
                            {c.unlocked ? 'UNLOCKED' : 'LOCKED TO PARTICIPANT'}
                          </span>
                        </div>
                        <p className="font-sans leading-relaxed">{c.clue_text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Guess History */}
                <div>
                  <div className="border-b border-gray-800 pb-2 mb-3 text-[#f59e0b] font-bold tracking-wider">
                    GUESS ATTEMPTS HISTORY ({detailData.guesses.length})
                  </div>
                  {detailData.guesses.length === 0 ? (
                    <p className="text-gray-500 italic py-2">No guesses submitted yet.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {detailData.guesses.map((g, idx) => (
                        <div
                          key={idx}
                          className={`p-2 rounded border flex items-center justify-between text-[11px] ${
                            g.is_correct
                              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                              : 'bg-red-950/20 border-red-900/40 text-red-300'
                          }`}
                        >
                          <div>
                            <strong>"{g.submitted_answer}"</strong> &bull; At Clue #{g.clue_number}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-500">
                              {new Date(g.created_at).toLocaleTimeString()}
                            </span>
                            <span className="font-bold">
                              {g.is_correct ? 'CORRECT' : 'WRONG'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Penalty & Audit Log */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="border-b border-gray-800 pb-2 mb-2 text-gray-400 font-bold">
                      PENALTY LOG ({detailData.penalties.length})
                    </div>
                    {detailData.penalties.length === 0 ? (
                      <p className="text-gray-500 text-[11px]">No penalties incurred.</p>
                    ) : (
                      <div className="space-y-1 max-h-28 overflow-y-auto pr-1 text-[11px]">
                        {detailData.penalties.map((pen) => (
                          <div
                            key={pen.id}
                            className="p-1.5 rounded bg-black/40 border border-gray-800 flex justify-between"
                          >
                            <span>{pen.penalty_type}</span>
                            <span
                              className={
                                pen.status === 'PENDING' ? 'text-[#f59e0b]' : 'text-emerald-400'
                              }
                            >
                              {pen.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="border-b border-gray-800 pb-2 mb-2 text-gray-400 font-bold">
                      ADMIN AUDIT LOG ({detailData.audit_logs.length})
                    </div>
                    {detailData.audit_logs.length === 0 ? (
                      <p className="text-gray-500 text-[11px]">No administrative actions recorded.</p>
                    ) : (
                      <div className="space-y-1 max-h-28 overflow-y-auto pr-1 text-[11px]">
                        {detailData.audit_logs.map((al, idx) => (
                          <div
                            key={idx}
                            className="p-1.5 rounded bg-black/40 border border-gray-800 flex justify-between"
                          >
                            <span>{al.action}</span>
                            <span className="text-gray-500">
                              {new Date(al.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
