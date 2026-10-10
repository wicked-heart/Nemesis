import { useState } from 'react';
import { Loader2, ArrowLeft, ShieldCheck, Lock } from 'lucide-react';
import DoomMask from './DoomMask';
import ArcaneCanvas from './ArcaneCanvas';
import { sounds } from '@/lib/sound';

interface AdminLoginProps {
  onSuccess: (password: string) => void;
  onBack: () => void;
}

export default function AdminLogin({ onSuccess, onBack }: AdminLoginProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    sounds.playClick();
    setLoading(true);
    setError('');
    setTimeout(() => {
      setLoading(false);
      onSuccess(password.trim());
    }, 200);
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

        <div className="terminal-panel p-6 md:p-8 border-t-2 border-t-[#f59e0b] shadow-[0_0_50px_rgba(0,0,0,0.85)]">
          <div className="mb-6 text-center">
            <div className="flex justify-center mb-3">
              <DoomMask size={64} glow={true} withRunes={true} />
            </div>
            <h2 className="font-regal text-2xl text-[#f59e0b] font-bold tracking-wider mb-1">
              ADMIN SUPERVISORY CONSOLE
            </h2>
            <div className="h-0.5 w-32 mx-auto bg-gradient-to-r from-transparent via-[#f59e0b] to-transparent" />
            <p className="text-xs text-gray-400 mt-2 font-mono">
              // NEMESIS ROUND 1: SURVEILLANCE &amp; CONTROLS
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 font-mono">
            <div>
              <label className="block text-xs text-[#f59e0b] mb-2 tracking-wider font-semibold">
                ADMINISTRATIVE ACCESS CIPHER
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="cyber-input"
                style={{ borderColor: 'rgba(245, 158, 11, 0.4)', color: '#fde047' }}
                disabled={loading}
                autoFocus
              />
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 p-2.5 rounded animate-shake">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="cyber-btn cyber-btn-cyan w-full text-sm mt-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> VERIFYING CIPHER...
                </>
              ) : (
                <>
                  <Lock size={15} /> ACCESS ADMIN CONSOLE
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
