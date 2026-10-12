import { createElement, useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

// Scroll-in animations (UI only). An element gets the class "is-in" the first time it scrolls into
// view; the CSS in index.css (.reveal) does the movement. Reduce Motion shows
// everything straight away.

function useRevealOnce<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('is-in');
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-in');
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

type Tag = 'div' | 'section' | 'p' | 'span' | 'li' | 'h1' | 'h2' | 'h3';

/** Fades and lifts its children in when they scroll into view. `delay` in seconds. */
export function Reveal({ as = 'div', className = '', delay = 0, children }: { as?: Tag; className?: string; delay?: number; children: ReactNode }) {
  const ref = useRevealOnce<HTMLElement>();
  return createElement(as, { ref, className: `reveal ${className}`, style: { '--d': `${delay}s` } as CSSProperties }, children);
}
