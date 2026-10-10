import { useState } from 'react';
import { User, Fingerprint, Loader2, ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react';
import { registerOrResumeParticipant } from '@/lib/api';
import DoomMask from './DoomMask';
import ArcaneCanvas from './ArcaneCanvas';
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
    <div className="min-h-screen cyber-grid scanlines flex flex-col items-center justify-center px-4 py-12 relative animate-fade-in">
      <ArcaneCanvas />

      <div className="max-w-md w-full relative z-10">
        <button
          onClick={() => {
            sounds.playClick();
            onBack();
          }}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-[#f59e0b] transition-colors mb-6 font-mono"
        >
          <ArrowLeft size={14} /> Back to Nemesis Gate
        </button>

        <div className="terminal-panel p-6 sm:p-8 border-t-2 border-t-[#10b981] shadow-[0_0_40px_rgba(0,0,0,0.8)]">
          <div className="mb-6 text-center">
            <div className="flex justify-center mb-3">
              <DoomMask size={64} glow={true} withRunes={false} />
            </div>
            <h2 className="font-regal text-2xl text-[#10b981] font-bold tracking-wider mb-1">
              CHALLENGER REGISTRATION
            </h2>
            <div className="h-0.5 w-36 mx-auto bg-gradient-to-r from-transparent via-[#f59e0b] to-transparent" />
            <p className="text-xs text-gray-400 mt-2 font-mono">
              // NEMESIS ROUND 1: FIND THE FLAG
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 font-mono text-left">
            <div>
              <label className="block text-xs text-[#10b981] mb-2 tracking-wider font-semibold">
                NAME
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="cyber-input pl-11"
                  maxLength={100}
                  disabled={loading}
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#f59e0b] mb-2 tracking-wider font-semibold">
                REGISTERED ROLL NUMBER (RRN)
              </label>
              <div className="relative">
                <Fingerprint size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-600" />
                <input
                  type="text"
                  value={participantId}
                  onChange={(e) => setParticipantId(e.target.value)}
                  placeholder="Enter your RRN"
                  className="cyber-input pl-11"
                  style={{ borderColor: 'rgba(245, 158, 11, 0.35)' }}
                  maxLength={50}
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 p-3 rounded animate-shake font-mono">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              onMouseEnter={() => sounds.playHover()}
              className="cyber-btn w-full text-sm mt-3 flex items-center justify-center gap-2"
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

          <div className="mt-6 pt-4 border-t border-gray-800 text-xs text-gray-500 text-center font-mono">
            <p className="flex items-center justify-center gap-1.5 text-gray-400">
              <Sparkles size={12} className="text-[#10b981]" />
              Automatic balanced random domain assignment
            </p>
            <p className="mt-1 text-gray-600">Re-entering with your exact RRN resumes your existing round.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
