import React, { useState, useEffect } from 'react';
import { ShieldAlert, Lock, AlertOctagon, Terminal, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import type { LockPhase } from '@/hooks/useLockStatus';
import type { ClueItem } from '@/lib/types';

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
        {/* Radar Restoration Sweep Beam */}
        <div className="absolute inset-x-0 h-4 bg-gradient-to-b from-transparent via-[#39ff88] to-transparent doom-radar-sweep pointer-events-none" />

        <div className="relative z-10 text-center max-w-xl p-8 rounded-lg border border-[#39ff88]/50 bg-[#091f13]/90 shadow-[0_0_60px_rgba(57,255,136,0.4)] animate-fade-in font-mono">
          <div className="w-16 h-16 rounded-full bg-emerald-950/80 border-2 border-[#39ff88] flex items-center justify-center mx-auto mb-4 text-[#39ff88] shadow-[0_0_25px_rgba(57,255,136,0.6)]">
            <ShieldAlert size={32} className="animate-spin" />
          </div>

          <h2 className="font-cinzel text-xl sm:text-2xl font-bold tracking-widest text-[#39ff88] mb-3">
            PARDON GRANTED
          </h2>

          <p className="font-cinzel font-semibold text-sm sm:text-base text-emerald-100 leading-relaxed mb-4">
            &ldquo;DOOM HAS GRANTED YOUR PARDON. ADVANCING TO NEXT CLUE.&rdquo;
          </p>

          <div className="text-[11px] text-emerald-400/80 tracking-wider flex items-center justify-center gap-2">
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
      className="fixed inset-0 z-[9999] pointer-events-auto select-none bg-[#030805] doom-screen-jitter overflow-y-auto flex flex-col justify-between p-4 sm:p-6 cursor-not-allowed selection:bg-[#39ff88] selection:text-black"
      role="dialog"
      aria-modal="true"
      aria-label="Corrupted Signal Locked by Doom"
    >
      {/* 1. Deep Atmospheric Dark Backdrop */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_center,rgba(15,46,28,0.5)_0%,rgba(3,8,5,0.98)_85%)] pointer-events-none" />

      {/* 2. Fine Phosphor CRT Horizontal Scanlines (No green dots) */}
      <div className="fixed inset-0 doom-crt-scanlines pointer-events-none opacity-40" />

      {/* 3. CRT Scanline Roll */}
      <div className="fixed inset-x-0 h-48 bg-gradient-to-b from-transparent via-[#39ff88]/10 to-transparent doom-crt-roll pointer-events-none" />

      {/* 4. High-Voltage Horizontal Noise Streaks */}
      <div className="fixed inset-x-0 top-1/4 h-1 bg-gradient-to-r from-transparent via-[#39ff88]/80 to-transparent doom-noise-streak pointer-events-none" />
      <div className="fixed inset-x-0 top-2/3 h-1 bg-gradient-to-r from-transparent via-[#c9a227]/70 to-transparent doom-noise-streak pointer-events-none" style={{ animationDelay: '1.6s' }} />

      {/* 5. CRT Glitch Slice Displacement Bands */}
      <div className="fixed inset-x-0 top-1/3 h-12 bg-[#39ff88]/10 mix-blend-screen doom-slice-band-1 pointer-events-none" />
      <div className="fixed inset-x-0 top-3/5 h-16 bg-[#c9a227]/10 mix-blend-screen doom-slice-band-2 pointer-events-none" />

      {/* --- TOP BAR / HUD CORNER PANEL & TELEMETRY --- */}
      <header className="relative z-10 w-full max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs font-mono border-b border-[#1f6f43]/50 pb-3">
        {/* Left: Operative ID */}
        <div className="flex items-center gap-3 bg-[#0d1f14]/85 px-3.5 py-1.5 rounded border border-[#1f6f43]/70 shadow-[0_0_15px_rgba(15,46,28,0.6)]">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
          <div>
            <div className="text-gray-400 text-[10px] tracking-widest uppercase">DISCIPLINED OPERATIVE</div>
            <div className="text-emerald-200 font-bold tracking-wide">
              {playerName || 'UNKNOWN'} <span className="text-gray-500 text-[10px]">[RRN: {rrn || 'N/A'}]</span>
            </div>
          </div>
        </div>

        {/* Center: Live Telemetry */}
        <div className="hidden md:flex items-center gap-3 text-[11px] text-emerald-400/80 bg-black/50 px-3 py-1 rounded border border-gray-800">
          <span>FREQ: 88.4 MHz</span>
          <span className="text-gray-600">//</span>
          <span>SIGNAL: [■■□□□□] 18%</span>
          <span className="text-gray-600">//</span>
          <span className="text-red-400 font-bold">CARRIER_LOST</span>
        </div>

        {/* Right: Strike Counter & Status */}
        <div className="flex items-center gap-3 bg-[#0d1f14]/85 px-3.5 py-1.5 rounded border border-[#c9a227]/50 shadow-[0_0_15px_rgba(201,162,39,0.25)]">
          <div>
            <div className="text-gray-400 text-[10px] tracking-widest uppercase text-right">INFRACTIONS</div>
            <div className="text-[#c9a227] font-bold tracking-wider text-right">
              {strikeCount} {strikeCount === 1 ? 'STRIKE' : 'STRIKES'} RECORDED
            </div>
          </div>
          <div className="px-2 py-0.5 rounded bg-red-950/80 border border-red-500/70 text-red-400 font-bold text-[10px] tracking-widest uppercase">
            STATUS: LOCKED
          </div>
        </div>
      </header>

      {/* --- MAIN CENTERPIECE: DOOM SILHOUETTE, GLITCH TITLE, QUOTE, & 3 BOXES --- */}
      <main className="relative z-10 my-auto py-4 flex flex-col items-center text-center max-w-2xl mx-auto w-full">
        {/* Dr. Doom Steel Mask & Cowl Silhouette */}
        <div className="mb-2 relative">
          <svg
            viewBox="0 0 200 240"
            className="w-24 h-28 sm:w-28 sm:h-32 filter drop-shadow-[0_0_35px_rgba(57,255,136,0.6)]"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="hoodGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#154228" />
                <stop offset="60%" stopColor="#0b2416" />
                <stop offset="100%" stopColor="#040d08" />
              </linearGradient>
              <linearGradient id="metalPlate" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#43494f" />
                <stop offset="50%" stopColor="#25292d" />
                <stop offset="100%" stopColor="#171a1c" />
              </linearGradient>
            </defs>
            {/* Hood Silhouette */}
            <path
              d="M100 15 C45 20 20 80 15 150 C10 195 30 225 35 235 C55 220 80 215 100 215 C120 215 145 220 165 235 C170 225 190 195 185 150 C180 80 155 20 100 15 Z"
              fill="url(#hoodGrad)"
              stroke="#1f6f43"
              strokeWidth="3.5"
            />
            {/* Iron Brow & Faceplate */}
            <path
              d="M48 95 L152 95 L144 140 L100 170 L56 140 Z"
              fill="url(#metalPlate)"
              stroke="#6b7480"
              strokeWidth="2.5"
            />
            {/* Eye Slits glowing Doom Emerald */}
            <polygon points="62,110 88,112 84,120 66,118" fill="#39ff88" />
            <polygon points="138,110 112,112 116,120 134,118" fill="#39ff88" />
            {/* Rivets & Breathing Grille */}
            <circle cx="100" cy="142" r="3" fill="#c9a227" />
            <line x1="85" y1="150" x2="115" y2="150" stroke="#39ff88" strokeWidth="2" />
            <line x1="88" y1="156" x2="112" y2="156" stroke="#39ff88" strokeWidth="2" />
          </svg>
        </div>

        {/* Headline: SIGNAL SEVERED BY DOOM (Layered Multi-Track Glitch Title) */}
        <div className="relative inline-block mb-2 select-none">
          {/* Red Aberration Ghost */}
          <span
            className="absolute inset-0 font-cinzel text-3xl sm:text-5xl lg:text-6xl font-black tracking-wider text-red-500 doom-rgb-ghost-red pointer-events-none"
            aria-hidden="true"
          >
            SIGNAL SEVERED BY DOOM
          </span>
          {/* Cyan Aberration Ghost */}
          <span
            className="absolute inset-0 font-cinzel text-3xl sm:text-5xl lg:text-6xl font-black tracking-wider text-cyan-400 doom-rgb-ghost-cyan pointer-events-none"
            aria-hidden="true"
          >
            SIGNAL SEVERED BY DOOM
          </span>
          {/* Foreground Emerald Headline */}
          <h1 className="doom-rgb-glitch font-cinzel text-3xl sm:text-5xl lg:text-6xl font-black tracking-wider text-emerald-200 drop-shadow-[0_0_25px_rgba(57,255,136,0.85)] relative z-10 uppercase">
            SIGNAL SEVERED BY DOOM
          </h1>
        </div>

        {/* Rotating Monospace Subtext with Typewriter Effect */}
        <div className="h-10 sm:h-12 flex items-center justify-center px-4 mb-5">
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
          <div className="w-full bg-[#0e2117]/90 border-2 border-[#c9a227]/70 rounded-lg p-4 sm:p-5 shadow-[0_0_25px_rgba(201,162,39,0.25)] text-left font-mono">
            <div className="flex items-center justify-between border-b border-[#c9a227]/30 pb-2 mb-3">
              <div className="flex items-center gap-2 text-[#c9a227] font-bold text-xs uppercase tracking-widest">
                <AlertOctagon size={16} /> PENALTY PROTOCOL ENFORCED
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-red-950/80 border border-red-500/50 text-red-300 font-bold tracking-wider">
                ATTEMPTS USED: {strikeCount} / 15 MAX
              </span>
            </div>
            <p className="text-gray-200 text-xs sm:text-sm leading-relaxed mb-3">
              REPORT TO: <span className="text-[#39ff88] font-bold">[PENALTY STATION / VOLUNTEER NAME]</span>. Complete your penance. Await Doom&apos;s pardon.
            </p>
            <div className="text-[11px] text-gray-300 bg-black/50 p-2.5 rounded border border-gray-800 flex items-center gap-2">
              <Lock size={14} className="text-red-400 shrink-0" />
              <span>
                {currentClueNumber < 15
                  ? `One guess per clue permitted. When an admin unlocks your terminal, you will automatically be sent to Clue #${currentClueNumber + 1}.`
                  : 'Final attempt (15/15) reached. Admin authorization will conclude your trial.'}
              </span>
            </div>
          </div>

          {/* BOX 2: ACTIVE TRANSMISSION / NEXT CLUE REDACTED STATUS */}
          <div className="w-full bg-[#0b1610]/90 border border-[#1f6f43]/60 rounded-lg p-4 font-mono text-left shadow-[0_0_20px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between text-[11px] text-gray-400 mb-2">
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
            <div className="relative py-2.5 px-4 bg-black/85 rounded border border-red-950/80 flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-red-950/25 doom-scanline-tear pointer-events-none" />
              <span className="font-cinzel text-xs sm:text-sm font-bold tracking-widest text-red-400 flex items-center gap-2">
                <span className="text-gray-600 select-none">██████</span>
                <span>ENCRYPTED BY DOOM</span>
                <span className="text-gray-600 select-none">██████</span>
              </span>
            </div>
          </div>

          {/* BOX 3: INSPECT DECRYPTED ARCHIVES (Read-Only Previous Clues) */}
          {unlockedClues.length > 0 && (
            <div className="w-full text-left font-mono text-xs">
              <button
                type="button"
                onClick={() => setShowArchives(!showArchives)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded bg-[#0d1e15]/90 border border-[#1f6f43]/60 text-emerald-300 hover:text-emerald-100 hover:border-[#39ff88]/50 transition-colors shadow-[0_0_15px_rgba(0,0,0,0.5)]"
              >
                <span className="flex items-center gap-2">
                  <FileText size={13} />
                  <span>INSPECT DECRYPTED ARCHIVES ({unlockedClues.length} CLUES VIEWABLE)</span>
                </span>
                {showArchives ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showArchives && (
                <div className="mt-2 max-h-48 overflow-y-auto space-y-2 p-3 bg-black/80 rounded border border-gray-800 text-[11px]">
                  {unlockedClues.map((c) => (
                    <div key={c.clue_number} className="p-2.5 rounded bg-[#0a140f] border border-gray-800/80">
                      <div className="text-[#c9a227] font-bold mb-1 flex items-center justify-between">
                        <span>CLUE #{c.clue_number}</span>
                        <span className="text-[10px] text-gray-500 font-normal">DECRYPTED INTEL</span>
                      </div>
                      <p className="text-gray-300 italic">&ldquo;{c.clue_text}&rdquo;</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* --- FOOTER STATUS BAR --- */}
      <footer className="relative z-10 w-full max-w-5xl mx-auto flex items-center justify-between pt-3 border-t border-[#1f6f43]/50 text-[11px] font-mono text-gray-500">
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
  );
}
