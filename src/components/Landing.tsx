import { useState, useEffect } from 'react';
import {
  Shield,
  Lock,
  Eye,
  ChevronRight,
  Cpu,
  AlertTriangle,
  Award,
  Sparkles,
} from 'lucide-react';
import Backdrop from './backdrop/Backdrop';
import NoCopy from './NoCopy';
import DoomHero from './doom3d/DoomHero';
import { Reveal } from './motion/Reveal';
import Depth from './motion/Depth';

interface LandingProps {
  onEnter: () => void;
}

const DOOM_QUOTES = [
  "In Round 1, knowledge is the greatest weapon. Read between the lines.",
  "Fifteen clues to pierce the veil. Guess wisely, or face the penalty.",
  "A boundary is only useful if it can distinguish what belongs inside from what does not.",
  "Trust nothing. Corroborate everything. Identify the domain before time runs out.",
  "None shall rival the supreme intellect of Victor Von Doom in the arena of Nemesis.",
];

export default function Landing({ onEnter }: LandingProps) {
  const [showRules, setShowRules] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % DOOM_QUOTES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const handleEnterClick = () => {
    onEnter();
  };

  const handleRulesClick = () => {
    setShowRules(true);
  };

  return (
    <div className="min-h-screen cyber-grid scanlines relative text-gray-200 flex flex-col justify-between selection:bg-doom-green selection:text-black">
      {/* Live background: the club site's moving dots, with a clear stage in the middle for the mask */}
      <Backdrop stage />
      <NoCopy />

      {/* --- Top Sovereign Status Bar --- */}
      <header className="hud-header sticky top-0 z-40 px-4 sm:px-6 bg-doom-void/85 border-b border-doom-line">
        <div className="max-w-6xl mx-auto h-16 flex items-center justify-between gap-3 text-xs font-mono">
          {/* Left: Defense Grid Status */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-2 w-2 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-doom-green opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-doom-green"></span>
            </span>
            <span className="text-doom-glow font-semibold tracking-[0.16em] flex items-center gap-1.5 truncate">
              <Cpu size={12} className="shrink-0" /> NEMESIS PROTOCOL // ROUND 1: FIND THE FLAG
            </span>
            <span className="text-gray-700 hidden sm:inline">|</span>
            <span className="text-doom-steel hidden lg:inline tracking-[0.12em]">SYSTEM INTEGRITY: VERIFIED</span>
          </div>

          {/* Right: Admin Link */}
          <div className="flex items-center gap-4 shrink-0">
            <a
              href="#/admin"
              className="chip text-gray-400 hover:text-doom-glow hover:border-doom-green/40 transition-colors"
            >
              <Lock size={11} />
              <span>ADMIN_CONSOLE</span>
            </a>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        {/* --- Hero --- */}
        {/* Depth: the hero's layers drift with the cursor and sink back as you scroll (UI only) */}
        <Depth className="min-h-[100svh] flex flex-col items-center justify-center px-4 pt-20 pb-10 text-center">
          {/* Centerpiece: the 3D Doom on a lit stage (a still image of him shows until it is ready, or if 3D can't run) */}
          <div className="hero-stage depth-2 depth-fade relative w-full flex justify-center">
            <span aria-hidden className="hero-beam" />
            <span aria-hidden className="hero-floor" />
            <DoomHero
              alert={showRules}
              className="hero-fade relative w-[min(100%,500px)] h-[38svh] sm:h-[46svh] min-h-[260px]"
            />
          </div>

          {/* Majestic Typography */}
          <div className="depth-1 depth-fade relative z-10 text-center mb-6 -mt-10 sm:-mt-14">
            <h1 className="wordmark wordmark-in text-[clamp(3.4rem,12vw,8.5rem)] leading-[0.9] uppercase mt-1" style={{ '--d': '0.2s' } as React.CSSProperties}>
              NEMESIS
            </h1>
            <div className="hairline w-64 sm:w-96 mx-auto mt-4 mb-4 rise" style={{ '--d': '0.6s' } as React.CSSProperties} />
            <p className="font-mono text-sm sm:text-base text-gray-100 tracking-[0.35em] uppercase rise [text-shadow:0_2px_14px_rgba(0,0,0,0.95)]" style={{ '--d': '0.7s' } as React.CSSProperties}>
              ROUND 1: FIND THE FLAG
            </p>
          </div>

          {/* Rotating Monologue / Decree Box */}
          <div
            className="depth-3 energy terminal-panel w-full max-w-2xl mx-auto mb-7 px-5 py-4 cursor-pointer group rise"
            style={{ '--d': '0.85s' } as React.CSSProperties}
            onClick={() => {
              setQuoteIndex((prev) => (prev + 1) % DOOM_QUOTES.length);
            }}
            title="Click to cycle quote"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] tracking-[0.18em] text-gray-500 mb-2.5 pb-2 border-b border-doom-line">
              <span className="flex items-center gap-1.5 text-doom-green">
                <Sparkles size={12} className="animate-pulse" />
                INTELLIGENCE BRIEFING // ROUND 1
              </span>
              <span className="group-hover:text-doom-glow transition-colors">
                CLICK TO CYCLE [ {quoteIndex + 1}/{DOOM_QUOTES.length} ]
              </span>
            </div>
            <p className="font-regal text-base sm:text-lg text-gray-100 leading-snug px-1 min-h-[2.8em] flex items-center justify-center">
              "{DOOM_QUOTES[quoteIndex]}"
            </p>
          </div>

          {/* Action Buttons */}
          <div className="depth-3 flex flex-col sm:flex-row gap-3 justify-center items-center w-full max-w-md rise" style={{ '--d': '1s' } as React.CSSProperties}>
            <button
              onClick={handleEnterClick}
              className="cyber-btn text-sm sm:text-base w-full flex items-center justify-center gap-2 group"
            >
              <span>Enter Round 1</span>
              <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={handleRulesClick}
              className="cyber-btn cyber-btn-cyan text-sm sm:text-base w-full flex items-center justify-center gap-2"
            >
              <Shield size={16} />
              <span>Rules &amp; Protocol</span>
            </button>
          </div>

          <div aria-hidden className="mt-8 flex justify-center rise" style={{ '--d': '1.3s' } as React.CSSProperties}>
            <span className="block w-px h-10 bg-gradient-to-b from-doom-green to-transparent scroll-hint" />
          </div>
        </Depth>

        {/* --- Key Pillars of Nemesis Round 1 --- */}
        <section className="px-4 sm:px-6 pt-14 pb-20 sm:pt-20 sm:pb-28">
          <div className="max-w-5xl mx-auto w-full">
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              {/* Card 1 */}
              <Reveal className="doom-feature-card energy p-6 sm:p-7">
                <div className="flex items-center gap-3 text-doom-glow mb-3 font-mono text-sm font-bold">
                  <span className="w-10 h-10 rounded-xl grid place-items-center bg-doom-green/10 border border-doom-green/25">
                    <Eye size={18} />
                  </span>
                  <span className="tracking-[0.16em]">15 PROGRESSIVE CLUES</span>
                </div>
                <p className="text-[15px] text-gray-300 leading-relaxed">
                  Each participant is assigned exactly one hidden domain. Clues evolve sequentially from abstract and challenging to highly identifiable.
                </p>
              </Reveal>

              {/* Card 2 */}
              <Reveal className="doom-feature-card energy p-6 sm:p-7" delay={0.12}>
                <div className="flex items-center gap-3 text-doom-steel mb-3 font-mono text-sm font-bold">
                  <span className="w-10 h-10 rounded-xl grid place-items-center bg-white/[0.04] border border-doom-steel/25">
                    <Award size={18} />
                  </span>
                  <span className="tracking-[0.16em]">EARLY-SOLVE SCORING</span>
                </div>
                <p className="text-[15px] text-gray-300 leading-relaxed">
                  Solve in Clues 1–4 for 15 pts. Clues 5–7 yield 12 pts, Clues 8–10 yield 9 pts, Clues 11–13 yield 6 pts, and Clues 14–15 yield 3 pts.
                </p>
              </Reveal>
            </div>
          </div>
        </section>
      </main>

      {/* --- Footer --- */}
      <footer className="relative z-10 border-t border-doom-line bg-doom-void/85 px-4 py-4 text-center text-[11px] font-mono tracking-[0.14em] text-gray-500">
        <p>NEMESIS // ROUND 1: FIND THE FLAG &bull; ALL RIGHTS RESERVED &bull; PERSISTENT VAULT ENABLED</p>
        {/* Credit required by the 3D mask's licence (CC BY 4.0) */}
        <p className="mt-1.5 text-[10px] tracking-normal text-gray-600">
          3D model:{' '}
          <a href="https://sketchfab.com/3d-models/doctor-dooms-mask-8db5464072f341a994ad1c729d9080f7" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 underline-offset-2 hover:underline">
            "Doctor Doom's Mask" by Nicolas_Laube
          </a>{' '}
          (
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 underline-offset-2 hover:underline">
            CC BY 4.0
          </a>
          ), textures compressed
        </p>
      </footer>

      {/* --- Rules Modal --- */}
      {showRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-fade-in">
          <div className="terminal-panel energy max-w-2xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-doom-line">
              <div className="flex items-center gap-2.5">
                <Shield className="text-doom-green" size={20} />
                <h3 className="font-regal text-lg sm:text-xl text-gray-100 font-bold tracking-wider">
                  ROUND 1: FIND THE FLAG — OFFICIAL RULES
                </h3>
              </div>
              <button
                onClick={() => setShowRules(false)}
                className="text-gray-500 hover:text-doom-glow font-mono text-lg"
              >
                [X]
              </button>
            </div>

            <RulesContent />

            <div className="mt-7 text-center">
              <button
                onClick={() => {
                  setShowRules(false);
                }}
                className="cyber-btn text-xs px-8"
              >
                Understood &bull; Ready to Begin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// The official rules, shown in the Rules & Protocol window.
function RulesContent() {
  return (
    <div className="space-y-3 text-[13px] text-gray-300 leading-relaxed">
      <div className="glass p-4">
        <span className="text-doom-glow font-semibold">1. Domain Assignment:</span>
        <p className="mt-1 text-gray-400">
          Each participant is automatically assigned exactly one domain from the 10 defined domains via balanced random selection. The assignment is permanent and stored in the database.
        </p>
      </div>

      <div className="glass p-4">
        <span className="text-doom-glow font-semibold">2. Progressive Clues:</span>
        <p className="mt-1 text-gray-400">
          Click <strong className="text-gray-200">Begin Round 1</strong> to start. Clue 1 is revealed initially. You may reveal subsequent clues one by one (up to Clue 15). Revealing the next clue does NOT count as a guess and incurs NO penalty.
        </p>
      </div>

      <div className="glass p-4 !border-amber-500/30 !bg-amber-500/[0.04]">
        <span className="text-amber-400 font-semibold flex items-center gap-1.5">
          <AlertTriangle size={14} /> 3. Guess Submission &amp; Penalties:
        </span>
        <p className="mt-1 text-gray-400">
          You can submit a guess at any unlocked clue. An incorrect guess records the attempt, increments your strikes, and activates the <code className="text-amber-400">Corrupted Signal Lock Screen</code> until reviewed and pardoned by an admin.
        </p>
      </div>

      <div className="glass p-4">
        <span className="text-doom-glow font-semibold">4. Scoring Brackets &amp; Speed Multipliers:</span>
        <p className="mt-1 text-gray-400 mb-3">
          Base score depends on the clue tier at which you submit the correct domain:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px] mb-3">
          <div className="p-2.5 rounded-lg bg-black/40 border border-doom-line">Clues 1–4: <strong className="text-emerald-400">15 Pts</strong></div>
          <div className="p-2.5 rounded-lg bg-black/40 border border-doom-line">Clues 5–7: <strong className="text-emerald-400">12 Pts</strong></div>
          <div className="p-2.5 rounded-lg bg-black/40 border border-doom-line">Clues 8–10: <strong className="text-emerald-400">9 Pts</strong></div>
          <div className="p-2.5 rounded-lg bg-black/40 border border-doom-line">Clues 11–13: <strong className="text-emerald-400">6 Pts</strong></div>
          <div className="p-2.5 rounded-lg bg-black/40 border border-doom-line">Clues 14–15: <strong className="text-emerald-400">3 Pts</strong></div>
          <div className="p-2.5 rounded-lg bg-black/40 border border-red-900/50 text-red-400">Exhausted (Clue 15): <strong>0 Pts (FAILED)</strong></div>
        </div>
        <div className="text-[12px] text-gray-300 space-y-1 border-t border-doom-line pt-3">
          <div className="text-cyan-400 font-semibold">Speed Efficiency Multiplier:</div>
          <div>&bull; <strong>&lt; 2 Mins:</strong> 1.30x Lightning Bonus (+30%)</div>
          <div>&bull; <strong>2–5 Mins:</strong> 1.15x Swift Bonus (+15%)</div>
          <div>&bull; <strong>5–10 Mins:</strong> 1.00x Standard Score</div>
          <div>&bull; <strong>10–15 Mins:</strong> 0.90x Overtime Multiplier (-10%)</div>
        </div>
      </div>

      <div className="glass p-4 !border-red-900/50">
        <span className="text-red-400 font-semibold">5. 15-Minute Countdown &amp; Auto-Submission:</span>
        <p className="mt-1 text-gray-400">
          Once you begin Round 1, a <strong className="text-gray-200">15-minute countdown timer</strong> begins immediately. If the 15 minutes expire before you submit a correct answer, the round is <strong className="text-gray-200">automatically submitted</strong> by the system and your performance card is generated immediately.
        </p>
      </div>

      <div className="glass p-4">
        <span className="text-doom-glow font-semibold">6. Leaderboard &amp; Tie-Breakers:</span>
        <p className="mt-1 text-gray-400">
          Leaderboard rankings are ordered strictly by: <strong className="text-gray-200">1. Highest Score</strong> &rarr; <strong className="text-gray-200">2. Lowest Time Taken</strong> (Fastest solve) &rarr; <strong className="text-gray-200">3. Lowest Wrong Guesses</strong>.
        </p>
      </div>
    </div>
  );
}
