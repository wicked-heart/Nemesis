import React, { useState, useEffect } from 'react';
import { ShieldAlert, Lock, AlertOctagon, Terminal, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import type { LockPhase } from '@/hooks/useLockStatus';
import type { ClueItem } from '@/lib/types';
import Doom3D from './doom3d/Doom3D';
import { BackdropSlot } from './backdrop/Backdrop';
import { preloadDoom } from './doom3d/preload';

// Fetch the 3D code quietly a few seconds after the app opens, so the lock screen's Doom is
// ready when it is needed (it only draws while the lock screen is showing).
if (typeof window !== 'undefined') setTimeout(preloadDoom, 4000);

interface SignalLostOverlayProps {
  phase: LockPhase;
  playerName: string;
  rrn: string;
  strikeCount: number;
  unlockedClues?: ClueItem[];
  currentClueNumber?: number;
}

const DOOM_QUOTES = [
  "You have defied Doom. Your transmission is revoked.",
  "Latveria's channels are closed to the unworthy.",
  "Doom's patience is finite. Your penance is not.",
  "Only the penalty can restore your signal.",
];

export default function SignalLostOverlay({
  phase,
  playerName,
  rrn,
  strikeCount,
  unlockedClues = [],
  currentClueNumber = 1,
}: SignalLostOverlayProps) {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [showArchives, setShowArchives] = useState(false);

  // Typewriter effect rotating every 6 seconds
  useEffect(() => {
    if (phase !== 'LOCKED') return;

    let charIdx = 0;
    const targetQuote = DOOM_QUOTES[quoteIndex];
    setDisplayedText('');

    // Typewriter interval (approx 35ms per character)
    const typeInterval = setInterval(() => {
      charIdx++;
      if (charIdx <= targetQuote.length) {
        setDisplayedText(targetQuote.slice(0, charIdx));
      } else {
        clearInterval(typeInterval);
      }
    }, 35);

    // 6-second rotation timer to next quote
    const rotateTimer = setTimeout(() => {
      setQuoteIndex((prev) => (prev + 1) % DOOM_QUOTES.length);
    }, 6000);

    return () => {
      clearInterval(typeInterval);
      clearTimeout(rotateTimer);
    };
  }, [quoteIndex, phase]);

  // Trap keyboard events while locked
  useEffect(() => {
    if (phase === 'IDLE') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['Enter', 'Space', 'Tab'].includes(e.code)) {
        e.stopPropagation();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [phase]);

  if (phase === 'IDLE') {
    return null;
  }

  // ==========================================
  // PARDON RESTORATION SCREEN (RELEASE PHASE)
  // ==========================================
  if (phase === 'RELEASING') {
    return (
      <div
        className="fixed inset-0 z-[9999] pointer-events-auto bg-[#020904] flex flex-col items-center justify-center px-4 overflow-hidden"
        role="status"
        aria-live="polite"
      >
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(34,197,94,0.18),transparent_70%)] pointer-events-none" />

        {/* Radar Restoration Sweep Beam */}
        <div className="absolute inset-x-0 h-4 bg-gradient-to-b from-transparent via-[#39ff88] to-transparent doom-radar-sweep pointer-events-none" />

        <div className="relative z-10 text-center max-w-xl w-full px-6 py-10 sm:px-10 rounded-3xl border border-[#39ff88]/40 bg-[#07170e]/90 shadow-[0_0_80px_-10px_rgba(57,255,136,0.45)] animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-emerald-950/80 border-2 border-[#39ff88] flex items-center justify-center mx-auto mb-6 text-[#39ff88] shadow-[0_0_30px_rgba(57,255,136,0.6)]">
            <ShieldAlert size={30} className="animate-spin" />
          </div>

          <h2 className="font-regal text-3xl sm:text-4xl font-bold tracking-[0.12em] text-[#39ff88] mb-4 drop-shadow-[0_0_20px_rgba(57,255,136,0.5)]">
            PARDON GRANTED
          </h2>

          <p className="font-regal font-semibold text-base sm:text-lg text-emerald-50 leading-relaxed mb-6">
            &ldquo;DOOM HAS GRANTED YOUR PARDON. ADVANCING TO NEXT CLUE.&rdquo;
          </p>

          <div className="font-mono text-[11px] text-emerald-400/80 tracking-[0.16em] flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#39ff88] animate-ping" />
            RE-ESTABLISHING UPLINK &bull; SYNCHRONIZING NEXT TRANSMISSION...
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // UNIFIED CORRUPTED SIGNAL GLITCH LOCK SCREEN
  // ==========================================
  return (
    <div
      className="fixed inset-0 z-[9999] pointer-events-auto select-none bg-[#030805] doom-screen-jitter overflow-hidden cursor-not-allowed selection:bg-[#39ff88] selection:text-black"
      role="dialog"
      aria-modal="true"
      aria-label="Corrupted Signal Locked by Doom"
    >
      {/* 1. Deep Atmospheric Dark Backdrop */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_center,rgba(15,46,28,0.55)_0%,rgba(3,8,5,0.98)_80%)] pointer-events-none" />

      {/* 1b. The page background as a corrupted signal: red dots, rows tearing sideways, a rolling scan band */}
      <BackdropSlot className="fixed inset-0" />

      {/* 2. Fine Phosphor CRT Horizontal Scanlines (No green dots) */}
      <div className="fixed inset-0 doom-crt-scanlines pointer-events-none opacity-40" />

      {/* 3. CRT Scanline Roll */}
      <div className="fixed inset-x-0 h-48 bg-gradient-to-b from-transparent via-[#39ff88]/10 to-transparent doom-crt-roll pointer-events-none" />

      {/* 4. High-Voltage Horizontal Noise Streaks */}
      <div className="fixed inset-x-0 top-1/4 h-1 bg-gradient-to-r from-transparent via-[#39ff88]/80 to-transparent doom-noise-streak pointer-events-none" />
      <div className="fixed inset-x-0 top-2/3 h-1 bg-gradient-to-r from-transparent via-red-500/70 to-transparent doom-noise-streak pointer-events-none" style={{ animationDelay: '1.6s' }} />

      {/* 5. CRT Glitch Slice Displacement Bands */}
      <div className="fixed inset-x-0 top-1/3 h-12 bg-[#39ff88]/10 mix-blend-screen doom-slice-band-1 pointer-events-none" />
      <div className="fixed inset-x-0 top-3/5 h-16 bg-red-500/10 mix-blend-screen doom-slice-band-2 pointer-events-none" />

      {/* The content scrolls in here, so the layers above stay pinned to the whole screen */}
      <div className="relative z-10 h-full overflow-y-auto flex flex-col justify-between p-4 sm:p-6">
        {/* --- TOP BAR / HUD CORNER PANEL & TELEMETRY --- */}
        <header className="relative z-10 w-full max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3 font-mono text-xs pb-4 border-b border-[#1f6f43]/40">
          {/* Left: Operative ID */}
          <div className="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-2xl border border-[#1f6f43]/60">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <div>
              <div className="text-gray-500 text-[10px] tracking-[0.18em] uppercase">DISCIPLINED OPERATIVE</div>
              <div className="text-emerald-100 font-bold tracking-wide">
                {playerName || 'UNKNOWN'} <span className="text-gray-500 text-[10px] font-normal">[RRN: {rrn || 'N/A'}]</span>
              </div>
            </div>
          </div>

          {/* Center: Live Telemetry */}
          <div className="hidden md:flex items-center gap-3 text-[11px] text-emerald-400/80 bg-black/50 px-4 py-2 rounded-full border border-gray-800">
            <span>FREQ: 88.4 MHz</span>
            <span className="text-gray-600">//</span>
            <span>SIGNAL: [■■□□□□] 18%</span>
            <span className="text-gray-600">//</span>
            <span className="text-red-400 font-bold">CARRIER_LOST</span>
          </div>

          {/* Right: Strike Counter & Status */}
          <div className="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-2xl border border-red-500/45 shadow-[0_0_24px_-6px_rgba(239,68,68,0.45)]">
            <div>
              <div className="text-gray-500 text-[10px] tracking-[0.18em] uppercase text-right">INFRACTIONS</div>
              <div className="text-red-400 font-bold tracking-wider text-right">
                {strikeCount} {strikeCount === 1 ? 'STRIKE' : 'STRIKES'} RECORDED
              </div>
            </div>
            <div className="px-2.5 py-1 rounded-full bg-red-950/80 border border-red-500/60 text-red-300 font-bold text-[10px] tracking-[0.16em] uppercase">
              STATUS: LOCKED
            </div>
          </div>
        </header>

        {/* --- MAIN CENTERPIECE: DOOM SILHOUETTE, GLITCH TITLE, QUOTE, & 3 BOXES --- */}
        <main className="relative z-10 my-auto py-6 flex flex-col items-center text-center max-w-2xl mx-auto w-full">
          {/* Doom judges you (3D); a red-eyed still image of him shows while it loads or if 3D is unavailable */}
          <div className="mb-2 relative">
            <Doom3D
              mode="judge"
              className="doom-stage is-red relative w-48 h-56 sm:w-60 sm:h-72"
            />
          </div>

          {/* Headline: SIGNAL SEVERED BY DOOM (Layered Multi-Track Glitch Title) */}
          <div className="relative inline-block mb-3 select-none">
            {/* Red Aberration Ghost */}
            <span
              className="absolute inset-0 font-regal text-3xl sm:text-5xl lg:text-6xl font-black tracking-wider text-red-500 doom-rgb-ghost-red pointer-events-none"
              aria-hidden="true"
            >
              SIGNAL SEVERED BY DOOM
            </span>
            {/* Cyan Aberration Ghost */}
            <span
              className="absolute inset-0 font-regal text-3xl sm:text-5xl lg:text-6xl font-black tracking-wider text-cyan-400 doom-rgb-ghost-cyan pointer-events-none"
              aria-hidden="true"
            >
              SIGNAL SEVERED BY DOOM
            </span>
            {/* Foreground Emerald Headline */}
            <h1 className="doom-rgb-glitch font-regal text-3xl sm:text-5xl lg:text-6xl font-black tracking-wider text-emerald-100 drop-shadow-[0_0_25px_rgba(57,255,136,0.85)] relative z-10 uppercase">
              SIGNAL SEVERED BY DOOM
            </h1>
          </div>

          {/* Rotating Monospace Subtext with Typewriter Effect */}
          <div className="h-12 flex items-center justify-center px-4 mb-6">
            <p className="font-mono text-xs sm:text-sm text-emerald-300 tracking-wide font-medium">
              &ldquo;{displayedText}&rdquo;
              <span className="inline-block w-2 h-4 bg-[#39ff88] ml-1 translate-y-0.5 animate-pulse" />
            </p>
          </div>

          {/* =========================================================
              THE 3 COMPONENT BOXES (ALL WITHIN THE GLITCH SCREEN)
             ========================================================= */}
          <div className="w-full space-y-3.5">
            {/* BOX 1: PENALTY PROTOCOL ENFORCED (Static Instruction Block) */}
            <div className="w-full bg-[#120707]/85 border border-red-500/60 rounded-2xl p-5 sm:p-6 shadow-[0_0_50px_-12px_rgba(239,68,68,0.5)] text-left">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-500/25 pb-3 mb-4">
                <div className="flex items-center gap-2 text-red-400 font-bold font-mono text-xs uppercase tracking-[0.18em]">
                  <AlertOctagon size={16} /> PENALTY PROTOCOL ENFORCED
                </div>
                <span className="font-mono text-[10px] px-2.5 py-1 rounded-full bg-red-950/80 border border-red-500/50 text-red-300 font-bold tracking-wider">
                  ATTEMPTS USED: {strikeCount} / 15 MAX
                </span>
              </div>
              <p className="text-gray-100 text-sm sm:text-[15px] leading-relaxed mb-4">
                REPORT TO: <span className="text-[#39ff88] font-bold">[PENALTY STATION / VOLUNTEER NAME]</span>. Complete your penance. Await Doom&apos;s pardon.
              </p>
              <div className="text-[12px] text-gray-300 bg-black/50 px-3.5 py-3 rounded-xl border border-gray-800 flex items-center gap-2.5">
                <Lock size={14} className="text-red-400 shrink-0" />
                <span>
                  {currentClueNumber < 15
                    ? `One guess per clue permitted. When an admin unlocks your terminal, you will automatically be sent to Clue #${currentClueNumber + 1}.`
                    : 'Final attempt (15/15) reached. Admin authorization will conclude your trial.'}
                </span>
              </div>
            </div>

            {/* BOX 2: ACTIVE TRANSMISSION / NEXT CLUE REDACTED STATUS */}
            <div className="w-full bg-black/50 border border-[#1f6f43]/50 rounded-2xl p-4 sm:p-5 font-mono text-left">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-400 mb-3">
                <span>
                  TRANSMISSION LOCKED AT CLUE #{currentClueNumber}
                  {currentClueNumber < 15 && (
                    <span className="text-[#39ff88] font-semibold ml-2">
                      &bull; NEXT: CLUE #{currentClueNumber + 1} UPON UNLOCK
                    </span>
                  )}
                </span>
                <span className="text-red-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Lock size={11} /> LOCKED
                </span>
              </div>
              {/* Redacted Bar with "ENCRYPTED BY DOOM" */}
              <div className="relative py-3 px-4 bg-black/85 rounded-xl border border-red-950/80 flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-red-950/25 doom-scanline-tear pointer-events-none" />
                <span className="font-regal text-xs sm:text-sm font-bold tracking-[0.2em] text-red-400 flex items-center gap-2">
                  <span className="text-gray-700 select-none">██████</span>
                  <span>ENCRYPTED BY DOOM</span>
                  <span className="text-gray-700 select-none">██████</span>
                </span>
              </div>
            </div>

            {/* BOX 3: INSPECT DECRYPTED ARCHIVES (Read-Only Previous Clues) */}
            {unlockedClues.length > 0 && (
              <div className="w-full text-left font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setShowArchives(!showArchives)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-black/50 border border-[#1f6f43]/50 text-emerald-300 hover:text-emerald-100 hover:border-[#39ff88]/50 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <FileText size={13} />
                    <span>INSPECT DECRYPTED ARCHIVES ({unlockedClues.length} CLUES VIEWABLE)</span>
                  </span>
                  {showArchives ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showArchives && (
                  <div className="mt-2 max-h-56 overflow-y-auto space-y-2 p-3 bg-black/80 rounded-2xl border border-gray-800 text-[12px]">
                    {unlockedClues.map((c) => (
                      <div key={c.clue_number} className="px-3.5 py-3 rounded-xl bg-white/[0.03] border border-gray-800/80">
                        <div className="text-red-400 font-bold mb-1.5 flex items-center justify-between">
                          <span>CLUE #{c.clue_number}</span>
                          <span className="text-[10px] text-gray-500 font-normal">DECRYPTED INTEL</span>
                        </div>
                        <p className="text-gray-200 font-sans text-[13px] italic">&ldquo;{c.clue_text}&rdquo;</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* --- FOOTER STATUS BAR --- */}
        <footer className="relative z-10 w-full max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-[#1f6f43]/40 text-[11px] font-mono text-gray-500">
          <div className="flex items-center gap-2">
            <Terminal size={12} className="text-[#39ff88]" />
            <span>LATVERIAN SECURE FREQUENCY 88.4 MHz</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-500/80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>LISTENING FOR IMPERIAL PARDON...</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
