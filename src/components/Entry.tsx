import { useState } from 'react';
import { User, Fingerprint, Loader2, ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react';
import { registerOrResumeParticipant } from '@/lib/api';
import DoomFace from './DoomFace';
import Backdrop from './backdrop/Backdrop';
import Doom3D from './doom3d/Doom3D';
import { sounds } from '@/lib/sound';

interface EntryProps {
  onStarted: () => void;
  onBack: () => void;
}

export default function Entry({ onStarted, onBack }: EntryProps) {
  const [name, setName] = useState('');
  const [participantId, setParticipantId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !participantId.trim()) {
      sounds.playError();
      setError('Both Name and Registered Roll Number (RRN) are required.');
      return;
    }

    setLoading(true);
    setError('');
    sounds.playClick();

    try {
      const result = await registerOrResumeParticipant(name.trim(), participantId.trim());
      if (result.error) {
        sounds.playError();
        setError(result.error);
        return;
      }
      sounds.playSuccess();
      onStarted();
    } catch (err) {
      sounds.playError();
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen cyber-grid scanlines flex flex-col px-4 sm:px-6 py-8 sm:py-12 relative animate-fade-in">
      <Backdrop />

      <div className="relative z-10 flex-1 w-full max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        {/* Left: registration form */}
        <div className="w-full max-w-md mx-auto lg:mx-0 lg:justify-self-end">
          <button
            onClick={() => {
              sounds.playClick();
              onBack();
            }}
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-doom-glow transition-colors mb-6 font-mono tracking-wide"
          >
            <ArrowLeft size={14} /> Back to Nemesis Gate
          </button>

          <div className="terminal-panel p-6 sm:p-8">
            <div className="mb-7 text-center lg:text-left">
              <div className="flex justify-center mb-4 lg:hidden">
                <DoomFace size={64} />
              </div>
              <span className="eyebrow">// NEMESIS ROUND 1: FIND THE FLAG</span>
              <h2 className="display text-[1.9rem] sm:text-[2.2rem] mt-4">
                CHALLENGER REGISTRATION
              </h2>
              <div className="hairline w-40 mt-4 mx-auto lg:mx-0 lg:bg-gradient-to-r lg:from-doom-green lg:to-transparent" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 text-left">
              <div>
                <label className="block font-mono text-[11px] text-gray-400 mb-2 tracking-[0.18em]">
                  NAME
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-doom-green" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="cyber-input pl-11 py-3.5"
                    maxLength={100}
                    disabled={loading}
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-[11px] text-gray-400 mb-2 tracking-[0.18em]">
                  REGISTERED ROLL NUMBER (RRN)
                </label>
                <div className="relative">
                  <Fingerprint size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-doom-green" />
                  <input
                    type="text"
                    value={participantId}
                    onChange={(e) => setParticipantId(e.target.value)}
                    placeholder="Enter your RRN"
                    className="cyber-input pl-11 py-3.5"
                    maxLength={50}
                    disabled={loading}
                  />
                </div>
              </div>

              {error && (
                <div className="text-xs text-red-300 bg-red-950/40 border border-red-500/40 px-4 py-3 rounded-xl animate-shake font-mono">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                onMouseEnter={() => sounds.playHover()}
                className="cyber-btn w-full text-sm py-3.5 mt-2 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> INITIALIZING SESSION...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} /> ENTER ROUND 1
                  </>
                )}
              </button>
            </form>

            <div className="mt-7 pt-5 border-t border-doom-line text-xs text-center lg:text-left space-y-1.5">
              <p className="flex items-center justify-center lg:justify-start gap-1.5 text-gray-300">
                <Sparkles size={12} className="text-doom-green" />
                Automatic balanced random domain assignment
              </p>
              <p className="text-gray-500">Re-entering with your exact RRN resumes your existing round.</p>
            </div>
          </div>
        </div>

        {/* Right: Doom watches (the 3D Doom takes this spot in Phase 5) */}
        <div aria-hidden className="hidden lg:flex flex-col items-center text-center">
          <Doom3D
            mode="watch"
            minWidth={1024}
            className="doom-stage relative w-[420px] h-[500px]"
          />
        </div>
      </div>
    </div>
  );
}
