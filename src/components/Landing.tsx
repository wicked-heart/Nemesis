import { useState, useEffect } from 'react';
import {
  Shield,
  Lock,
  Eye,
  ChevronRight,
  Cpu,
  Target,
  AlertTriangle,
  Award,
  Sparkles,
} from 'lucide-react';
import DoomMask from './DoomMask';
import ArcaneCanvas from './ArcaneCanvas';

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
    <div className="min-h-screen cyber-grid scanlines relative text-gray-200 flex flex-col justify-between selection:bg-[#10b981] selection:text-black">
      {/* Interactive Background Particle Matrix */}
      <ArcaneCanvas />

      {/* --- Top Sovereign Status Bar --- */}
      <header className="relative z-20 border-b border-gray-800/80 bg-[#020704]/90 backdrop-blur-md px-4 py-2.5">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          {/* Left: Defense Grid Status */}
          <div className="flex items-center gap-3">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]"></span>
            </span>
            <span className="text-[#10b981] font-semibold tracking-wider flex items-center gap-1.5">
              <Cpu size={12} /> NEMESIS PROTOCOL // ROUND 1: FIND THE FLAG
            </span>
            <span className="text-gray-700 hidden sm:inline">|</span>
            <span className="text-[#f59e0b] hidden md:inline">SYSTEM INTEGRITY: VERIFIED</span>
          </div>

          {/* Right: Admin Link */}
          <div className="flex items-center gap-4">
            <a
              href="#/admin"
              className="flex items-center gap-1 text-gray-500 hover:text-[#f59e0b] transition-colors tracking-widest text-[11px]"
            >
              <Lock size={11} />
              <span>ADMIN_CONSOLE</span>
            </a>
          </div>
        </div>
      </header>

      {/* --- Main Hero Container --- */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-10 md:py-16 max-w-5xl mx-auto w-full">
        {/* Centerpiece Mask with Rotating Arcane Rings */}
        <div className="mb-6 animate-flicker">
          <DoomMask size={105} glow={true} withRunes={true} />
        </div>

        {/* Majestic Typography */}
        <div className="text-center mb-6">
          <h1 className="font-regal text-5xl sm:text-7xl md:text-8xl font-black text-[#10b981] animate-pulse-glow tracking-[0.08em] mb-3 uppercase">
            NEMESIS
          </h1>
          <div className="h-0.5 w-72 sm:w-96 mx-auto bg-gradient-to-r from-transparent via-[#f59e0b] to-transparent mb-4 shadow-[0_0_10px_#f59e0b]" />
          <p className="font-title text-base sm:text-xl md:text-2xl text-[#f59e0b] tracking-[0.3em] uppercase font-bold">
            ROUND 1: FIND THE FLAG
          </p>
        </div>

        {/* Rotating Monologue / Decree Box */}
        <div
          className="w-full max-w-2xl mx-auto mb-8 p-4 rounded bg-black/60 border border-[#10b981]/30 backdrop-blur-md relative overflow-hidden transition-all cursor-pointer group"
          onClick={() => {
            setQuoteIndex((prev) => (prev + 1) % DOOM_QUOTES.length);
          }}
          title="Click to cycle quote"
        >
          <div className="flex items-center justify-between text-[11px] font-mono text-gray-500 mb-2 border-b border-gray-800 pb-1">
            <span className="flex items-center gap-1.5 text-[#10b981]">
              <Sparkles size={12} className="animate-pulse" />
              INTELLIGENCE BRIEFING // ROUND 1
            </span>
            <span className="text-[10px] text-gray-600 group-hover:text-[#f59e0b] transition-colors">
              CLICK TO CYCLE [ {quoteIndex + 1}/{DOOM_QUOTES.length} ]
            </span>
          </div>
          <p className="font-mono text-sm sm:text-base text-gray-300 italic text-center leading-relaxed px-2">
            "{DOOM_QUOTES[quoteIndex]}"
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full max-w-md mb-12">
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

        {/* --- Key Pillars of Nemesis Round 1 --- */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 mb-10 text-left">
          {/* Card 1 */}
          <div className="doom-feature-card p-5 rounded">
            <div className="flex items-center gap-2.5 text-[#10b981] mb-2 font-mono text-sm font-bold">
              <Eye size={18} />
              <span className="tracking-wider">15 PROGRESSIVE CLUES</span>
            </div>
            <p className="text-xs text-gray-400 font-mono leading-relaxed">
              Each participant is assigned exactly one hidden domain. Clues evolve sequentially from abstract and challenging to highly identifiable.
            </p>
          </div>

          {/* Card 2 */}
          <div className="doom-feature-card p-5 rounded">
            <div className="flex items-center gap-2.5 text-[#f59e0b] mb-2 font-mono text-sm font-bold">
              <Award size={18} />
              <span className="tracking-wider">EARLY-SOLVE SCORING</span>
            </div>
            <p className="text-xs text-gray-400 font-mono leading-relaxed">
              Solve in Clues 1–4 for 15 pts. Clues 5–7 yield 12 pts, Clues 8–10 yield 9 pts, Clues 11–13 yield 6 pts, and Clues 14–15 yield 3 pts.
            </p>
          </div>
        </div>

        {/* --- 10 Domains Overview --- */}
        <div className="w-full terminal-panel p-5 rounded text-left">
          <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
            <div className="flex items-center gap-2 text-xs font-mono">
              <Target size={14} className="text-[#f59e0b]" />
              <span className="text-[#f59e0b] font-bold tracking-widest uppercase">
                THE 10 CANDIDATE DOMAINS
              </span>
            </div>
            <span className="text-[11px] font-mono text-gray-500">1 DOMAIN PER PARTICIPANT</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 font-mono text-xs">
            {[
              'Cybersecurity',
              'Healthcare',
              'Space Exploration',
              'Finance & Banking',
              'Education & Learning',
              'Sports',
              'Agriculture & Farming',
              'Transportation & Travel',
              'Crime Investigation & Forensics',
              'Artificial Intelligence',
            ].map((domain, i) => (
              <div
                key={domain}
                className="p-2.5 rounded bg-black/40 border border-gray-800/80 text-gray-300 text-center flex flex-col justify-center items-center gap-1 hover:border-[#10b981]/40 transition-colors"
              >
                <span className="text-[10px] text-[#10b981] font-bold">#{String(i + 1).padStart(2, '0')}</span>
                <span className="font-semibold text-[11px]">{domain}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* --- Footer --- */}
      <footer className="relative z-10 border-t border-gray-800/80 bg-[#020704]/90 px-4 py-3 text-center text-xs font-mono text-gray-500">
        <p>NEMESIS // ROUND 1: FIND THE FLAG &bull; ALL RIGHTS RESERVED &bull; PERSISTENT VAULT ENABLED</p>
      </footer>

      {/* --- Rules Modal --- */}
      {showRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="terminal-panel max-w-2xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto border-t-2 border-t-[#10b981]">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Shield className="text-[#10b981]" size={20} />
                <h3 className="font-regal text-xl text-[#10b981] font-bold tracking-wider">
                  ROUND 1: FIND THE FLAG — OFFICIAL RULES
                </h3>
              </div>
              <button
                onClick={() => setShowRules(false)}
                className="text-gray-500 hover:text-[#10b981] font-mono text-lg"
              >
                [X]
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono text-gray-300 leading-relaxed">
              <div className="p-3 bg-black/40 border border-[#10b981]/20 rounded">
                <span className="text-[#10b981] font-bold">1. Domain Assignment:</span>
                <p className="mt-1 text-gray-400">
                  Each participant is automatically assigned exactly one domain from the 10 defined domains via balanced random selection. The assignment is permanent and stored in the database.
                </p>
              </div>

              <div className="p-3 bg-black/40 border border-[#10b981]/20 rounded">
                <span className="text-[#10b981] font-bold">2. Progressive Clues:</span>
                <p className="mt-1 text-gray-400">
                  Click <strong>Begin Round 1</strong> to start. Clue 1 is revealed initially. You may reveal subsequent clues one by one (up to Clue 15). Revealing the next clue does NOT count as a guess and incurs NO penalty.
                </p>
              </div>

              <div className="p-3 bg-black/40 border border-[#f59e0b]/30 rounded">
                <span className="text-[#f59e0b] font-bold">3. Guess Submission &amp; Penalties:</span>
                <p className="mt-1 text-gray-400">
                  You can submit a guess at any unlocked clue. An incorrect guess records the attempt, increments your strikes, and activates the <code className="text-[#f59e0b]">Corrupted Signal Lock Screen</code> until reviewed and pardoned by an admin.
                </p>
              </div>

              <div className="p-3 bg-black/40 border border-emerald-900/40 rounded">
                <span className="text-emerald-400 font-bold">4. Scoring Brackets &amp; Speed Multipliers:</span>
                <p className="mt-1 text-gray-400 mb-2">
                  Base score depends on the clue tier at which you submit the correct domain:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] mb-3">
                  <div className="p-2 bg-black/50 border border-gray-800 rounded">Clues 1–4: <strong className="text-emerald-400">15 Pts</strong></div>
                  <div className="p-2 bg-black/50 border border-gray-800 rounded">Clues 5–7: <strong className="text-emerald-400">12 Pts</strong></div>
                  <div className="p-2 bg-black/50 border border-gray-800 rounded">Clues 8–10: <strong className="text-emerald-400">9 Pts</strong></div>
                  <div className="p-2 bg-black/50 border border-gray-800 rounded">Clues 11–13: <strong className="text-emerald-400">6 Pts</strong></div>
                  <div className="p-2 bg-black/50 border border-gray-800 rounded">Clues 14–15: <strong className="text-emerald-400">3 Pts</strong></div>
                  <div className="p-2 bg-black/50 border border-red-900/50 rounded text-red-400">Exhausted (Clue 15): <strong>0 Pts (FAILED)</strong></div>
                </div>
                <div className="text-[11px] text-gray-300 space-y-1 border-t border-gray-800/80 pt-2">
                  <div className="text-cyan-400 font-semibold">Speed Efficiency Multiplier:</div>
                  <div>&bull; <strong>&lt; 2 Mins:</strong> 1.30x Lightning Bonus (+30%)</div>
                  <div>&bull; <strong>2–5 Mins:</strong> 1.15x Swift Bonus (+15%)</div>
                  <div>&bull; <strong>5–10 Mins:</strong> 1.00x Standard Score</div>
                  <div>&bull; <strong>10–15 Mins:</strong> 0.90x Overtime Multiplier (-10%)</div>
                </div>
              </div>

              <div className="p-3 bg-black/40 border border-red-900/40 rounded">
                <span className="text-red-400 font-bold">5. 15-Minute Countdown &amp; Auto-Submission:</span>
                <p className="mt-1 text-gray-400">
                  Once you begin Round 1, a <strong>15-minute countdown timer</strong> begins immediately. If the 15 minutes expire before you submit a correct answer, the round is <strong>automatically submitted</strong> by the system and your performance card is generated immediately.
                </p>
              </div>

              <div className="p-3 bg-black/40 border border-gray-800 rounded">
                <span className="text-[#f59e0b] font-bold">6. Leaderboard &amp; Tie-Breakers:</span>
                <p className="mt-1 text-gray-400">
                  Leaderboard rankings are ordered strictly by: <strong>1. Highest Score</strong> &rarr; <strong>2. Lowest Time Taken</strong> (Fastest solve) &rarr; <strong>3. Lowest Wrong Guesses</strong>.
                </p>
              </div>
            </div>

            <div className="mt-6 text-center">
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
