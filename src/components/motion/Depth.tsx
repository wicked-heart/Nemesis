import { createElement, useEffect, useRef, type ReactNode } from 'react';

// Depth for a hero section (UI only). It writes three CSS variables on itself and the CSS does the rest:
//   --dx, --dy : where the cursor is, -1..1 (layers with .depth-1 / .depth-2 / .depth-3 drift by different
//                amounts, so the scene feels deep)
//   --sp       : how far the section has scrolled away, 0..1 (.depth-recede sinks it back as you scroll)
// Touch screens and Reduce Motion get a still section.

type Tag = 'section' | 'div';

export default function Depth({ as = 'section', className = '', children }: { as?: Tag; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const target = { x: 0, y: 0 };
    const now = { x: 0, y: 0 };
    let raf = 0;
    const tick = () => {
      raf = 0;
      now.x += (target.x - now.x) * 0.08;
      now.y += (target.y - now.y) * 0.08;
      el.style.setProperty('--dx', now.x.toFixed(4));
      el.style.setProperty('--dy', now.y.toFixed(4));
      const r = el.getBoundingClientRect();
      el.style.setProperty('--sp', Math.min(1, Math.max(0, -r.top / Math.max(1, r.height))).toFixed(4));
      if (Math.abs(target.x - now.x) > 0.001 || Math.abs(target.y - now.y) > 0.001) raf = requestAnimationFrame(tick);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const move = (e: PointerEvent) => {
      if (!fine) return;
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
      schedule();
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('scroll', schedule, { passive: true });
    schedule();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('scroll', schedule);
    };
  }, []);
  return createElement(as, { ref, className: `depth ${className}` }, children);
}
