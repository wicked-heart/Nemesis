// Picks how much 3D work this device can handle, so lab PCs and cheap phones stay smooth.

export type Quality = { tier: 'low' | 'mid' | 'high'; maxDpr: number; antialias: boolean };

export function detectQuality(): Quality {
  const touch = window.matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  let tier: Quality['tier'] = 'high';
  if (touch) tier = memory <= 3 || cores <= 4 ? 'low' : 'mid';
  if (cores <= 2) tier = 'low';
  const dpr = window.devicePixelRatio || 1;
  if (tier === 'low') return { tier, maxDpr: Math.min(dpr, 1.25), antialias: false };
  if (tier === 'mid') return { tier, maxDpr: Math.min(dpr, 1.6), antialias: true };
  return { tier, maxDpr: Math.min(dpr, 2), antialias: true };
}

let webgl: boolean | null = null;
export function hasWebGL() {
  if (webgl !== null) return webgl;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    webgl = !!gl;
  } catch {
    webgl = false;
  }
  return webgl;
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
