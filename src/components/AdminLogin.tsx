import { useState } from 'react';
import { Loader2, ArrowLeft, ShieldCheck, Lock } from 'lucide-react';
import Backdrop from './backdrop/Backdrop';
import Doom3D from './doom3d/Doom3D';
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
      <Backdrop />

      <div className="max-w-md w-full relative z-10">
        <button
          onClick={() => {
            sounds.playClick();
            onBack();
          }}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-doom-glow transition-colors mb-6 font-mono tracking-wide"
        >
          <ArrowLeft size={14} /> Back to Nemesis Gate
        </button>

        <div className="terminal-panel p-6 md:p-8">
          <div className="mb-7 text-center">
            <div className="flex justify-center mb-3">
              <Doom3D mode="mask" className="relative w-32 h-32" />
            </div>
            <span className="eyebrow !tracking-[0.12em]">// NEMESIS ROUND 1: SURVEILLANCE &amp; CONTROLS</span>
            <h2 className="display text-[1.7rem] sm:text-[2rem] mt-4">
              ADMIN SUPERVISORY CONSOLE
            </h2>
            <div className="hairline w-32 mx-auto mt-4" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="flex items-center gap-1.5 font-mono text-[11px] text-gray-400 mb-2 tracking-[0.18em]">
                <ShieldCheck size={12} className="text-doom-green" /> ADMINISTRATIVE ACCESS CIPHER
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="cyber-input py-3.5"
                disabled={loading}
                autoFocus
              />
            </div>

            {error && (
              <div className="text-xs text-red-300 bg-red-950/40 border border-red-500/40 px-4 py-3 rounded-xl animate-shake">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="cyber-btn w-full text-sm py-3.5 mt-2 flex items-center justify-center gap-2"
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
