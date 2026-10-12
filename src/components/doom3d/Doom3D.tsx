import { useEffect, useRef, useState, type ReactNode } from 'react';
import { detectQuality, hasWebGL, prefersReducedMotion } from './quality';
import { makeDoomInput, type DoomInput, type DoomMode } from './types';
import DoomPoster from './DoomPoster';
import { claimStage, releaseStage, updateStage } from './stage';

// The 3D Doom mask for any screen (UI only). It:
//  - shows `fallback` (by default a still image of Doom, see DoomPoster.tsx) until the 3D is drawn, and
//    for good if WebGL is missing or fails
//  - downloads the 3D code only when a screen uses it, and shares one 3D scene across all screens
//    (see stage.tsx), so moving between pages never rebuilds it
//  - pauses drawing when off screen or when the tab is hidden
//  - reads the cursor, typing and form submits from the page with passive listeners — it never
//    touches any form, handler or game state.

type Props = {
  mode: DoomMode;
  className?: string;
  /** What to show before / instead of the 3D (default: a still image of Doom). */
  fallback?: ReactNode;
  /** Optional shared input (the Landing page sets `alert` while the Rules window is open). */
  input?: React.MutableRefObject<DoomInput>;
  /** Called once the mask is drawn (or straight away if 3D is unavailable). */
  onReady?: (ok: boolean) => void;
  /** Only use 3D on screens at least this wide (px); smaller screens keep the fallback. */
  minWidth?: number;
  /** Only use 3D on screens at most this wide (px). */
  maxWidth?: number;
};

export default function Doom3D({ mode, className = 'relative', fallback, input, onReady, minWidth = 0, maxWidth = Infinity }: Props) {
  const still = fallback ?? <DoomPoster red={mode === 'judge'} dim={mode === 'lose'} />;
  const own = useRef<DoomInput>(makeDoomInput());
  const inputRef = input ?? own;
  const wrapRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const stageId = useRef(0);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const [device] = useState(() => ({ webgl: hasWebGL() && window.innerWidth >= minWidth && window.innerWidth <= maxWidth, quality: detectQuality(), reduced: prefersReducedMotion() }));
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(true);
  const usable = device.webgl && !failed;

  useEffect(() => {
    if (!usable) onReady?.(false);
  }, [usable, onReady]);

  // Borrow the shared 3D scene for this box while it is on screen.
  useEffect(() => {
    const slot = slotRef.current;
    if (!usable || !slot) return;
    const id = claimStage(
      {
        slot,
        mode,
        input: inputRef,
        running: true,
        onReady: () => {
          setReady(true);
          onReadyRef.current?.(true);
        },
        onFail: () => setFailed(true),
      },
      device.quality,
      device.reduced,
    );
    stageId.current = id;
    return () => {
      releaseStage(id);
      stageId.current = 0;
    };
    // The mood and pausing are passed on below; claim once per box.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usable]);

  useEffect(() => {
    if (stageId.current) updateStage(stageId.current, { mode, running });
  }, [mode, running]);

  // Pause when the canvas is off screen or the tab is hidden (saves battery and lab PCs).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !usable) return;
    let onScreen = true;
    const update = () => setRunning(onScreen && !document.hidden);
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      update();
    }, { rootMargin: '120px' });
    io.observe(el);
    document.addEventListener('visibilitychange', update);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, [usable]);

  // Cursor / finger anywhere on the page, typing and form submits (read-only, passive).
  useEffect(() => {
    if (!usable) return;
    const inp = inputRef.current;
    const move = (e: PointerEvent) => {
      inp.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      inp.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
      inp.pointer.active = true;
    };
    const leave = () => {
      inp.pointer.active = false;
    };
    const typed = (e: Event) => {
      if (e.target instanceof HTMLInputElement) inp.pulse = performance.now();
    };
    const submitted = () => {
      inp.flash = performance.now();
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave, { passive: true });
    document.addEventListener('input', typed, { passive: true, capture: true });
    document.addEventListener('submit', submitted, { passive: true, capture: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', move);
      document.documentElement.removeEventListener('pointerleave', leave);
      document.removeEventListener('input', typed, { capture: true });
      document.removeEventListener('submit', submitted, { capture: true });
    };
  }, [usable, inputRef]);

  return (
    <div ref={wrapRef} className={className || 'relative'} aria-hidden>
      {still && (
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-700 ${usable && ready ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          {still}
        </div>
      )}
      {usable && <div ref={slotRef} className={`absolute inset-0 transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`} />}
    </div>
  );
}
