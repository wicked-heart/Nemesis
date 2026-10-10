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
} from 'lucide-react';
import {
  getAdminDashboard,
  getAdminParticipantDetails,
  resolvePenalty,
} from '@/lib/api';
import type {
  AdminDashboardData,
  AdminParticipantRow,
  AdminParticipantDetail,
  RoundStatus,
  PlayerStatus,
} from '@/lib/types';
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
  const [activeTab, setActiveTab] = useState<'overview' | 'scoreboard'>('overview');
  const [scoreSearchQuery, setScoreSearchQuery] = useState('');

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

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

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
          return 8;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [autoRefresh, loadDashboard]);

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
                      <th className="py-3 px-2 text-center">Clue</th>
                      <th className="py-3 px-2 text-center">Wrong</th>
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

                            {/* Wrong Guesses */}
                            <td className="py-3 px-2 text-center">
                              <span
                                className={`font-bold ${
                                  p.wrong_guess_count > 0 ? 'text-red-400' : 'text-gray-500'
                                }`}
                              >
                                {p.wrong_guess_count}
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
                                    title="Mark player status as NORMAL"
                                  >
                                    {resolvingId === p.session_id ? (
                                      <Loader2 size={10} className="animate-spin" />
                                    ) : (
                                      <ShieldCheck size={11} />
                                    )}
                                    <span>Resolve Penalty</span>
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
                      <AlertTriangle size={16} />
                      <span>Outstanding penalty pending administrative resolution.</span>
                    </div>
                    <button
                      onClick={() => handleResolvePenalty(detailData.session_id)}
                      disabled={resolvingId === detailData.session_id}
                      className="cyber-btn text-xs px-4 py-1.5 flex items-center gap-1.5"
                    >
                      {resolvingId === detailData.session_id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <ShieldCheck size={13} />
                      )}
                      <span>Resolve Penalty to NORMAL</span>
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
