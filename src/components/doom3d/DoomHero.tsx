import { useEffect, useRef, type ReactNode } from 'react';
import Doom3D from './Doom3D';
import { makeDoomInput } from './types';

// The Landing page's 3D mask (UI only). `alert` is true while the Rules window is open: the mask's
// eyes turn red and it leans in. A still image of Doom shows until the 3D is drawn.
export default function DoomHero({ alert = false, className, fallback }: { alert?: boolean; className?: string; fallback?: ReactNode }) {
  const input = useRef(makeDoomInput());
  useEffect(() => {
    input.current.alert = alert;
  }, [alert]);
  return <Doom3D mode="watch" input={input} className={className} fallback={fallback} />;
}
