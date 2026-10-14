import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw } from 'lucide-react';

export interface WheelPenalty {
  id: string;
  name: string;
  label: string;
  color: string;
  colorDark: string;
  pipColor: string;
}

// Exactly 6 sections so the two-tone palette (Doom Cloak Emerald vs Plated Iron) alternates seamlessly
export const WHEEL_PENALTIES: WheelPenalty[] = [
  {
    id: 'bitter_gourd_juice',
    name: 'Bitter Gourd Juice',
    label: 'BITTER GOURD JUICE',
    color: '#0f3d24', // Cloak Emerald
    colorDark: '#072113',
    pipColor: '#22c55e',
  },
  {
    id: 'pick_up_line',
    name: 'Pick Up Line',
    label: 'PICK UP LINE',
    color: '#151d18', // Plated Iron
    colorDark: '#0c120e',
    pipColor: '#8a9a90',
  },
  {
    id: 'movie_action',
    name: 'Movie Action',
    label: 'MOVIE ACTION',
    color: '#0f3d24', // Cloak Emerald
    colorDark: '#072113',
    pipColor: '#22c55e',
  },
  {
    id: 'movie_dialogue',
    name: 'Movie Dialogue',
    label: 'MOVIE DIALOGUE',
    color: '#151d18', // Plated Iron
    colorDark: '#0c120e',
    pipColor: '#8a9a90',
  },
  {
    id: 'ai_image_prompt',
    name: 'AI Image Prompt',
    label: 'AI IMAGE PROMPT',
    color: '#0f3d24', // Cloak Emerald
    colorDark: '#072113',
    pipColor: '#22c55e',
  },
  {
    id: 'mimic_marvel_character',
    name: 'Mimic a Marvel Character',
    label: 'MIMIC A MARVEL CHARACTER',
    color: '#151d18', // Plated Iron
    colorDark: '#0c120e',
    pipColor: '#8a9a90',
  },
];

const SEGMENTS_COUNT = WHEEL_PENALTIES.length; // Exactly 6 sections (60° each)

// ---------------------------------------------------------------------------------------------
// How the wheel looks (UI only: the spin, the odds and the verdict are untouched).
// Doom's armour: the plates alternate between his green cloak and his iron mask, copper studs like
// the clasps on his cloak run round a forged iron rim, and his face sits in the hub: green eyes at
// rest, burning red while he decides. The rim, plates and light are drawn once into hidden canvases,
// so each frame of a spin is only a few image copies.
// ---------------------------------------------------------------------------------------------
const SIZE = 640;
const C = SIZE / 2;
const TAU = Math.PI * 2;
const STEP = TAU / SEGMENTS_COUNT;
const PLATE_R = 250; // outer edge of the plates
const TRACK_R = 276; // the studs run in a sunken track between the plates and the rim
const RIM_R = 298;
const STUD_R = 263; // one copper stud per plate: flicks the pointer as the wheel rotates
const HUB_R = 84; // Doom's face and its ring (HTML over the canvas)
const LABEL_IN = HUB_R + 20;
const LABEL_OUT = PLATE_R - 16;

// Doom's face in the hub (the same render as the rest of the app). Eye positions are in the image's pixels.
const FACE = { src: '/models/doom-face.webp', px: 256, x: 9, y: 2.5, size: 150 };
const FACE_EYES = [
  { x: 90, y: 122 },
  { x: 175, y: 122 },
];
const faceX = (px: number) => FACE.x + (px * FACE.size) / FACE.px;
const faceY = (px: number) => FACE.y + (px * FACE.size) / FACE.px;
const HUB_STYLE = {
  width: `${((HUB_R * 2) / SIZE) * 100}%`,
  height: `${((HUB_R * 2) / SIZE) * 100}%`,
  left: `${((C - HUB_R) / SIZE) * 100}%`,
  top: `${((C - HUB_R) / SIZE) * 100}%`,
};

type Caches = { key: string; rim: HTMLCanvasElement; body: HTMLCanvasElement; light: HTMLCanvasElement };

function layer(scale: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.round(SIZE * scale);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.translate(C, C);
    draw(ctx);
  }
  return canvas;
}

function sector(ctx: CanvasRenderingContext2D, a0: number, a1: number, r0: number, r1: number) {
  ctx.beginPath();
  ctx.arc(0, 0, r1, a0, a1);
  ctx.arc(0, 0, r0, a1, a0, true);
  ctx.closePath();
}

function ring(ctx: CanvasRenderingContext2D, r0: number, r1: number) {
  ctx.beginPath();
  ctx.arc(0, 0, r1, 0, TAU);
  ctx.arc(0, 0, r0, TAU, 0, true);
}

// Fixed noise, so the brushed metal looks the same every time.
function noise(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// A domed rivet lit from the top left (the light stays put while the wheel turns).
function rivet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, copper: boolean) {
  ctx.beginPath();
  ctx.arc(x + 0.5, y + 1.3, r + 0.7, 0, TAU);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r);
  const stops = copper ? ['#ffe3bd', '#d98d4c', '#8c4a1d', '#2e1405'] : ['#ffffff', '#c9d1d6', '#66706b', '#1a1f1c'];
  [0, 0.35, 0.78, 1].forEach((t, i) => g.addColorStop(t, stops[i]));
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = g;
  ctx.fill();
}

const labelFont = (ctx: CanvasRenderingContext2D, size: number) => {
  ctx.font = `700 ${size}px Cinzel, serif`;
  ctx.letterSpacing = '1.5px';
};

// Fit a plate's name between the hub and the rim: one line if it fits, otherwise two even lines.
function fitLabel(ctx: CanvasRenderingContext2D, label: string) {
  const room = LABEL_OUT - LABEL_IN;
  const width = (lines: string[], size: number) => {
    labelFont(ctx, size);
    return Math.max(...lines.map((line) => ctx.measureText(line).width));
  };
  for (let size = 17; size >= 13; size--) if (width([label], size) <= room) return { lines: [label], size };
  const words = label.split(' ');
  let lines = [label];
  let best = Infinity;
  for (let k = 1; k < words.length; k++) {
    const pair = [words.slice(0, k).join(' '), words.slice(k).join(' ')];
    const w = width(pair, 14);
    if (w < best) {
      best = w;
      lines = pair;
    }
  }
  for (let size = 16; size > 10; size--) if (width(lines, size) <= room) return { lines, size };
  return { lines, size: 10 };
}

// The forged iron rim and the sunken stud track (still).
function drawRim(ctx: CanvasRenderingContext2D) {
  // The wheel's shadow on the page.
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 8;
  ctx.beginPath();
  ctx.arc(0, 0, RIM_R, 0, TAU);
  ctx.fillStyle = '#050706';
  ctx.fill();
  ctx.restore();

  const t = (r: number) => (r - PLATE_R) / (RIM_R - PLATE_R);
  const band = ctx.createRadialGradient(0, 0, PLATE_R, 0, 0, RIM_R);
  band.addColorStop(0, '#020302');
  band.addColorStop(t(TRACK_R) - 0.04, '#0b100d');
  band.addColorStop(t(TRACK_R), '#222a26');
  band.addColorStop(t(TRACK_R) + 0.1, '#3c4641');
  band.addColorStop(0.82, '#1b211e');
  band.addColorStop(1, '#080b09');
  ring(ctx, PLATE_R, RIM_R);
  ctx.fillStyle = band;
  ctx.fill();

  // Brushed-steel sheen on the outer band.
  if ('createConicGradient' in ctx) {
    const sheen = ctx.createConicGradient(-Math.PI * 0.75, 0, 0);
    [
      [0, 'rgba(255,255,255,0.24)'],
      [0.08, 'rgba(255,255,255,0.03)'],
      [0.24, 'rgba(255,255,255,0.09)'],
      [0.4, 'rgba(0,0,0,0.3)'],
      [0.5, 'rgba(255,255,255,0.13)'],
      [0.6, 'rgba(0,0,0,0.25)'],
      [0.76, 'rgba(255,255,255,0.06)'],
      [0.92, 'rgba(255,255,255,0.03)'],
      [1, 'rgba(255,255,255,0.24)'],
    ].forEach(([at, colour]) => sheen.addColorStop(at as number, colour as string));
    ring(ctx, TRACK_R, RIM_R);
    ctx.fillStyle = sheen;
    ctx.fill();
  }

  // Bevels: light catches the top-left edges.
  const lit = (alpha: number) => {
    const g = ctx.createLinearGradient(-RIM_R, -RIM_R, RIM_R, RIM_R);
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(0.5, 'rgba(255,255,255,0.03)');
    g.addColorStop(1, 'rgba(0,0,0,0.6)');
    return g;
  };
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = lit(0.5);
  ctx.beginPath();
  ctx.arc(0, 0, RIM_R - 0.8, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = lit(0.35);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, TRACK_R + 0.6, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, TRACK_R - 0.8, 0, TAU);
  ctx.stroke();

  // Engraved notches and steel rivets round the band.
  const mid = (TRACK_R + RIM_R) / 2;
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU;
    if (i % 6 === 3) {
      rivet(ctx, Math.cos(a) * mid, Math.sin(a) * mid, 3.2, false);
      continue;
    }
    const long = i % 6 === 0;
    const r0 = mid - (long ? 6 : 3.5);
    const r1 = mid + (long ? 6 : 3.5);
    for (const [shift, colour] of [
      [0, 'rgba(0,0,0,0.75)'],
      [0.9, 'rgba(255,255,255,0.12)'],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0 + shift, Math.sin(a) * r0 + shift);
      ctx.lineTo(Math.cos(a) * r1 + shift, Math.sin(a) * r1 + shift);
      ctx.lineWidth = long ? 1.4 : 1;
      ctx.strokeStyle = colour;
      ctx.stroke();
    }
  }

  // The app's green hairline round the outside.
  ctx.beginPath();
  ctx.arc(0, 0, RIM_R + 0.6, 0, TAU);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(34, 197, 94, 0.45)';
  ctx.stroke();
}

// The plates and their names (these turn).
function drawBody(ctx: CanvasRenderingContext2D) {
  const rand = noise(7);
  WHEEL_PENALTIES.forEach((penalty, i) => {
    const mid = i * STEP;
    const a0 = mid - STEP / 2;
    const a1 = mid + STEP / 2;
    const cloak = i % 2 === 0;

    ctx.save();
    sector(ctx, a0, a1, HUB_R - 14, PLATE_R);
    ctx.clip();
    const base = ctx.createRadialGradient(0, 0, HUB_R, 0, 0, PLATE_R);
    const shades = cloak ? ['#03130a', '#0c3f22', '#13603a', '#072b16'] : ['#080b0a', '#1e2421', '#323b36', '#131816'];
    [0, 0.4, 0.78, 1].forEach((at, n) => base.addColorStop(at, shades[n]));
    ctx.fillStyle = base;
    ctx.fillRect(-C, -C, SIZE, SIZE);

    if (cloak) {
      // Knitted cloth: fine diagonal threads, and a stitched hem near the rim.
      ctx.save();
      ctx.rotate(mid);
      ctx.lineWidth = 1;
      for (let k = -PLATE_R * 1.6; k < PLATE_R; k += 3.2) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.beginPath();
        ctx.moveTo(0, k);
        ctx.lineTo(PLATE_R, k + PLATE_R * 0.6);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(160, 255, 200, 0.035)';
        ctx.beginPath();
        ctx.moveTo(0, k + 1.2);
        ctx.lineTo(PLATE_R, k + 1.2 + PLATE_R * 0.6);
        ctx.stroke();
      }
      ctx.restore();
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(160, 240, 190, 0.28)';
      ctx.beginPath();
      ctx.arc(0, 0, PLATE_R - 9, a0 + 0.03, a1 - 0.03);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      // Brushed iron, with an engraved panel like the plates of his mask.
      for (let r = HUB_R - 14; r < PLATE_R; r += 1.4) {
        const v = rand();
        ctx.strokeStyle = v > 0.5 ? `rgba(255,255,255,${((v - 0.5) * 0.14).toFixed(3)})` : `rgba(0,0,0,${((0.5 - v) * 0.32).toFixed(3)})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(0, 0, r, a0, a1);
        ctx.stroke();
      }
      const panel = () => {
        ctx.beginPath();
        ctx.arc(0, 0, PLATE_R - 13, a0 + 0.06, a1 - 0.06);
        ctx.arc(0, 0, HUB_R + 16, a1 - 0.17, a0 + 0.17, true);
        ctx.closePath();
      };
      panel();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.stroke();
      ctx.save();
      ctx.translate(0.7, 0.9);
      panel();
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.stroke();
      ctx.restore();
    }

    // Each plate is shaded darker at its edges, so it looks rounded.
    if ('createConicGradient' in ctx) {
      const f = STEP / TAU;
      const shade = ctx.createConicGradient(a0, 0, 0);
      shade.addColorStop(0, 'rgba(0,0,0,0.5)');
      shade.addColorStop(f * 0.2, 'rgba(0,0,0,0.04)');
      shade.addColorStop(f * 0.5, cloak ? 'rgba(140,255,190,0.06)' : 'rgba(255,255,255,0.07)');
      shade.addColorStop(f * 0.8, 'rgba(0,0,0,0.04)');
      shade.addColorStop(f, 'rgba(0,0,0,0.5)');
      shade.addColorStop(Math.min(1, f + 0.001), 'rgba(0,0,0,0)');
      ctx.fillStyle = shade;
      ctx.fillRect(-C, -C, SIZE, SIZE);
    }
    ctx.restore();

    // The penalty's name, engraved along the plate.
    ctx.save();
    ctx.rotate(mid);
    const { lines, size } = fitLabel(ctx, penalty.label);
    labelFont(ctx, size);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const x = (LABEL_IN + LABEL_OUT) / 2;
    lines.forEach((line, n) => {
      const y = (n - (lines.length - 1) / 2) * size * 1.2;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fillText(line, x, y + 1.4);
      ctx.shadowColor = cloak ? 'rgba(74, 222, 128, 0.4)' : 'rgba(255, 255, 255, 0.18)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = cloak ? '#e3f8ea' : '#eef2ef';
      ctx.fillText(line, x, y);
      ctx.shadowBlur = 0;
    });
    ctx.restore();
  });

  // Dark seams between the plates, with a sliver of light on each plate's edge.
  for (let i = 0; i < SEGMENTS_COUNT; i++) {
    const a = i * STEP - STEP / 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const line = (shift: number) => {
      ctx.beginPath();
      ctx.moveTo(cos * (HUB_R - 14) - sin * shift, sin * (HUB_R - 14) + cos * shift);
      ctx.lineTo(cos * PLATE_R - sin * shift, sin * PLATE_R + cos * shift);
    };
    line(0);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#010201';
    ctx.stroke();
    line(2.4);
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.13)';
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, PLATE_R - 0.5, 0, TAU);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#010201';
  ctx.stroke();
}

// Light from the top left that stays put while the plates turn under it, plus soft shadows.
function drawLight(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.arc(0, 0, PLATE_R, 0, TAU);
  ctx.clip();
  const light = ctx.createRadialGradient(-120, -150, 10, -120, -150, 330);
  light.addColorStop(0, 'rgba(255, 255, 255, 0.14)');
  light.addColorStop(0.5, 'rgba(255, 255, 255, 0.04)');
  light.addColorStop(1, 'rgba(255, 255, 255, 0)');
  const edge = ctx.createRadialGradient(0, 0, PLATE_R - 28, 0, 0, PLATE_R);
  edge.addColorStop(0, 'rgba(0, 0, 0, 0)');
  edge.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
  const hub = ctx.createRadialGradient(0, 5, HUB_R - 6, 0, 5, HUB_R + 36);
  hub.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
  hub.addColorStop(1, 'rgba(0, 0, 0, 0)');
  for (const fill of [light, edge, hub]) {
    ctx.fillStyle = fill;
    ctx.fillRect(-C, -C, SIZE, SIZE);
  }
}

// The pointer: a steel blade with a copper collar and Doom's eye as its jewel (red while he judges).
function drawPointer(ctx: CanvasRenderingContext2D, deflection: number, judging: boolean) {
  const pivot = RIM_R - 8;
  const tip = PLATE_R - 6 - pivot;
  ctx.save();
  ctx.translate(C + pivot, C);
  ctx.rotate(deflection);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.beginPath();
  ctx.moveTo(tip, 0);
  ctx.lineTo(-24, -15);
  ctx.lineTo(14, -11);
  ctx.quadraticCurveTo(24, 0, 14, 11);
  ctx.lineTo(-24, 15);
  ctx.closePath();
  const steel = ctx.createLinearGradient(0, -15, 0, 15);
  steel.addColorStop(0, '#f5f8f6');
  steel.addColorStop(0.45, '#aab4ae');
  steel.addColorStop(0.55, '#4b5550');
  steel.addColorStop(1, '#1b201d');
  ctx.fillStyle = steel;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(tip + 3, 0);
  ctx.lineTo(14, 0);
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.stroke();

  const copper = ctx.createLinearGradient(0, -18, 0, 18);
  copper.addColorStop(0, '#ffd9a8');
  copper.addColorStop(0.4, '#c77a3a');
  copper.addColorStop(1, '#4a2208');
  ctx.fillStyle = copper;
  ctx.fillRect(-31, -17.5, 9, 35);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.strokeRect(-31, -17.5, 9, 35);

  const [core, colour, deep] = judging ? ['#ffe4e6', '#ff3b4f', '#7f0010'] : ['#eafff1', '#22c55e', '#064e22'];
  ctx.shadowColor = judging ? 'rgba(255, 59, 79, 0.95)' : 'rgba(34, 197, 94, 0.9)';
  ctx.shadowBlur = 14;
  const eye = ctx.createRadialGradient(-2.5, -2, 0.5, 0, 0, 7);
  eye.addColorStop(0, core);
  eye.addColorStop(0.5, colour);
  eye.addColorStop(1, deep);
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, TAU);
  ctx.fillStyle = eye;
  ctx.fill();
  ctx.restore();
}

export default function WheelOfDoom() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Wheel State
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentRotation, setCurrentRotation] = useState(0); // in radians
  const [lastVerdict, setLastVerdict] = useState<WheelPenalty | null>(null);

  // Ticker flapper spring deflection (in radians)
  const flapperDeflection = useRef(0);
  const lastPegIndex = useRef<number>(-1);
  const animationFrameRef = useRef<number | null>(null);
  const currentRotationRef = useRef(0);

  // Look only: the drawn layers, and whether Doom is judging (spinning, or a verdict is showing).
  const cacheRef = useRef<Caches | null>(null);
  const fontsReadyRef = useRef(false);
  const judgingRef = useRef(false);
  const spinningRef = useRef(false);
  const verdictShownRef = useRef(false);
  const judging = isSpinning || lastVerdict !== null;

  // Helper: determine which segment is at the pointer (pointer is at 3 o'clock / East / angle 0)
  const getSegmentAtAngle = useCallback((rot: number): WheelPenalty => {
    const step = (Math.PI * 2) / SEGMENTS_COUNT;
    const localAngle = ((-rot % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const index = Math.floor((localAngle + step / 2) / step) % SEGMENTS_COUNT;
    return WHEEL_PENALTIES[index];
  }, []);

  // Canvas drawing routine
  const renderWheel = useCallback((rotation: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(SIZE * dpr);
    const targetH = Math.round(SIZE * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    // The still layers are drawn once at the screen's own resolution and copied pixel for pixel.
    const key = `${dpr}|${fontsReadyRef.current}`;
    let caches = cacheRef.current;
    if (!caches || caches.key !== key) {
      caches = { key, rim: layer(dpr, drawRim), body: layer(dpr, drawBody), light: layer(dpr, drawLight) };
      cacheRef.current = caches;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(caches.rim, 0, 0);

    // Always reset transform explicitly so scaling NEVER compounds across renders
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    ctx.translate(C, C);
    ctx.rotate(rotation);
    // While spinning, the plates are a ready-made picture turned each frame (fast); at rest they are
    // drawn directly, so the names are perfectly sharp.
    if (spinningRef.current) ctx.drawImage(caches.body, -C, -C, SIZE, SIZE);
    else drawBody(ctx);
    ctx.restore();

    // Copper studs (one per plate) and the iron plates' rivets, lit from the same side every frame.
    for (let i = 0; i < SEGMENTS_COUNT; i++) {
      const a = i * STEP + rotation;
      rivet(ctx, C + Math.cos(a) * STUD_R, C + Math.sin(a) * STUD_R, 5.6, true);
      if (i % 2 === 1) {
        for (const [r, da] of [
          [PLATE_R - 22, STEP / 2 - 0.075],
          [HUB_R + 30, STEP / 2 - 0.2],
        ]) {
          for (const side of [-1, 1]) {
            rivet(ctx, C + Math.cos(a + side * da) * r, C + Math.sin(a + side * da) * r, 2.8, false);
          }
        }
      }
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(caches.light, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // The verdict: the other plates sink into shadow and the chosen one is outlined in Doom's red.
    if (verdictShownRef.current) {
      const chosen = WHEEL_PENALTIES.indexOf(getSegmentAtAngle(rotation));
      ctx.save();
      ctx.translate(C, C);
      ctx.rotate(rotation);
      for (let i = 0; i < SEGMENTS_COUNT; i++) {
        if (i === chosen) continue;
        sector(ctx, i * STEP - STEP / 2, i * STEP + STEP / 2, HUB_R - 14, PLATE_R);
        ctx.fillStyle = 'rgba(2, 4, 3, 0.62)';
        ctx.fill();
      }
      sector(ctx, chosen * STEP - STEP / 2, chosen * STEP + STEP / 2, HUB_R - 12, PLATE_R - 1.5);
      ctx.shadowColor = 'rgba(255, 59, 79, 0.95)';
      ctx.shadowBlur = 18;
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(255, 96, 108, 0.95)';
      ctx.stroke();
      ctx.restore();
    }

    drawPointer(ctx, flapperDeflection.current, judgingRef.current);
  }, [getSegmentAtAngle]);

  // Redraw when rotation changes
  useEffect(() => {
    currentRotationRef.current = currentRotation;
    renderWheel(currentRotation);
  }, [currentRotation, renderWheel]);

  useEffect(() => {
    renderWheel(currentRotationRef.current);
  }, [renderWheel]);

  // Look only: redraw once Doom starts or stops judging, and once the Cinzel font has loaded for the names.
  useEffect(() => {
    judgingRef.current = judging;
    spinningRef.current = isSpinning;
    verdictShownRef.current = lastVerdict !== null && !isSpinning;
    renderWheel(currentRotationRef.current);
  }, [judging, lastVerdict, isSpinning, renderWheel]);

  useEffect(() => {
    let alive = true;
    document.fonts
      ?.load('700 16px Cinzel')
      .then(() => {
        if (!alive) return;
        fontsReadyRef.current = true;
        renderWheel(currentRotationRef.current);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [renderWheel]);

  // Spin trigger function
  const spinWheel = useCallback(() => {
    if (isSpinning) return;

    setIsSpinning(true);
    setLastVerdict(null);

    // Physics parameters: strictly <= 3.5s (3.2s)
    const SPIN_DURATION_MS = 3200;
    const startRot = currentRotationRef.current;

    // Spin 6 to 9 full turns + random target slice offset
    const fullSpins = 6 + Math.random() * 3;
    const randomOffset = Math.random() * Math.PI * 2;
    const totalRotationDelta = fullSpins * Math.PI * 2 + randomOffset;
    const targetEndRot = startRot + totalRotationDelta;

    const startTime = performance.now();
    const step = (Math.PI * 2) / SEGMENTS_COUNT;

    lastPegIndex.current = Math.floor(startRot / step);

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / SPIN_DURATION_MS);

      // Quartic ease-out deceleration curve for realistic physical friction
      const easeOut = 1 - Math.pow(1 - progress, 4.2);

      const currentAngle = startRot + totalRotationDelta * easeOut;
      setCurrentRotation(currentAngle);

      const currentPeg = Math.floor(currentAngle / step);
      if (currentPeg !== lastPegIndex.current) {
        lastPegIndex.current = currentPeg;
        flapperDeflection.current = -0.22;
      }

      flapperDeflection.current *= 0.82;
      if (Math.abs(flapperDeflection.current) < 0.005) {
        flapperDeflection.current = 0;
      }

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setIsSpinning(false);
        flapperDeflection.current = 0;
        setCurrentRotation(targetEndRot);

        const finalPenalty = getSegmentAtAngle(targetEndRot);
        setLastVerdict(finalPenalty);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [isSpinning, getSegmentAtAngle]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] py-4 animate-fade-in font-mono select-none">
      {/* The Roulette Wheel Canvas */}
      <div className={`wheel-doom relative flex items-center justify-center w-full max-w-[560px] aspect-square ${judging ? 'is-judging' : ''}`}>
        {/* A glow behind the wheel: green, turning red while Doom decides */}
        <div className="wheel-aura wheel-aura-green" aria-hidden="true" />
        <div className="wheel-aura wheel-aura-red" aria-hidden="true" />
        <canvas
          ref={canvasRef}
          className="relative w-full h-full cursor-pointer"
          onClick={!isSpinning ? spinWheel : undefined}
          title={isSpinning ? 'Spinning...' : 'Click to spin'}
        />

        {/* Doom in the hub (clicks pass through to the wheel) */}
        <div className="wheel-hub" style={HUB_STYLE} aria-hidden="true">
          <svg className="block w-full h-full" viewBox="0 0 168 168">
            <defs>
              <linearGradient id="wod-bevel" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#f2f6f3" />
                <stop offset="0.45" stopColor="#7d8983" />
                <stop offset="1" stopColor="#121614" />
              </linearGradient>
              <radialGradient id="wod-ring" cx="0.4" cy="0.35" r="0.75">
                <stop offset="0" stopColor="#3b4540" />
                <stop offset="0.6" stopColor="#171c19" />
                <stop offset="1" stopColor="#070908" />
              </radialGradient>
              <radialGradient id="wod-rivet" cx="0.35" cy="0.3" r="0.7">
                <stop offset="0" stopColor="#ffe3bd" />
                <stop offset="0.45" stopColor="#c77a3a" />
                <stop offset="1" stopColor="#2e1405" />
              </radialGradient>
              <radialGradient id="wod-vignette">
                <stop offset="0.72" stopColor="#000" stopOpacity="0" />
                <stop offset="1" stopColor="#000" stopOpacity="0.8" />
              </radialGradient>
              <radialGradient id="wod-eye">
                <stop offset="0" stopColor="#fff1f2" />
                <stop offset="0.3" stopColor="#ff3b4f" stopOpacity="0.95" />
                <stop offset="1" stopColor="#ff3b4f" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="wod-eyes-fade">
                <stop offset="0.5" stopColor="#fff" />
                <stop offset="1" stopColor="#000" />
              </radialGradient>
              <mask id="wod-eyes-mask">
                <ellipse
                  cx={(faceX(FACE_EYES[0].x) + faceX(FACE_EYES[1].x)) / 2}
                  cy={faceY(FACE_EYES[0].y) + 3}
                  rx={40}
                  ry={22}
                  fill="url(#wod-eyes-fade)"
                />
              </mask>
              <filter id="wod-red" colorInterpolationFilters="sRGB">
                <feColorMatrix type="hueRotate" values="-140" />
                <feColorMatrix type="saturate" values="1.7" />
              </filter>
              <clipPath id="wod-face">
                <circle cx="84" cy="84" r="62" />
              </clipPath>
              <path id="wod-top" d="M 11 84 A 73 73 0 0 1 157 84" fill="none" />
              <path id="wod-bottom" d="M 11 84 A 73 73 0 0 0 157 84" fill="none" />
            </defs>

            <circle cx="84" cy="84" r="84" fill="url(#wod-bevel)" />
            <circle cx="84" cy="84" r="82" fill="url(#wod-ring)" />
            <text className="font-regal" fill="#e7efe9" fontSize="12.5" fontWeight="800" letterSpacing="5" dominantBaseline="central">
              <textPath href="#wod-top" startOffset="50%" textAnchor="middle">
                DOOM
              </textPath>
            </text>
            <text className="font-mono" fill="#4ade80" fontSize="8.5" fontWeight="700" letterSpacing="3.5" dominantBaseline="central">
              <textPath href="#wod-bottom" startOffset="50%" textAnchor="middle">
                VERDICT
              </textPath>
            </text>
            <circle cx="11.5" cy="84" r="3" fill="url(#wod-rivet)" />
            <circle cx="156.5" cy="84" r="3" fill="url(#wod-rivet)" />

            <circle cx="84" cy="84" r="64" fill="#010302" stroke="url(#wod-bevel)" strokeWidth="1.5" />
            <g clipPath="url(#wod-face)">
              <image href={FACE.src} x={FACE.x} y={FACE.y} width={FACE.size} height={FACE.size} />
              <image
                className="wheel-face-red"
                href={FACE.src}
                x={FACE.x}
                y={FACE.y}
                width={FACE.size}
                height={FACE.size}
                filter="url(#wod-red)"
                mask="url(#wod-eyes-mask)"
              />
              {FACE_EYES.map((eye) => (
                <circle key={eye.x} className="wheel-eye" cx={faceX(eye.x)} cy={faceY(eye.y)} r="11" fill="url(#wod-eye)" />
              ))}
              <circle cx="84" cy="84" r="62" fill="url(#wod-vignette)" />
            </g>
          </svg>
        </div>
      </div>

      {/* Result Display: Shown after the wheel stops spinning */}
      {lastVerdict && !isSpinning && (
        <div className="mt-6 text-center animate-fade-in space-y-1">
          <div className="flex items-center justify-center gap-3 text-[11px] font-mono tracking-[0.3em] text-red-300/80 uppercase">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-red-500/70" aria-hidden="true" />
            PENALTY VERDICT
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-red-500/70" aria-hidden="true" />
          </div>
          <div className="wheel-verdict-name font-regal text-3xl sm:text-5xl font-bold uppercase tracking-wider text-red-50 drop-shadow-[0_0_22px_rgba(255,59,79,0.55)]">
            {lastVerdict.name}
          </div>
        </div>
      )}

      {/* Spin Button in Nemesis Emerald Sovereign style */}
      <div className="mt-6">
        <button
          onClick={spinWheel}
          disabled={isSpinning}
          className={`px-10 py-3.5 rounded-full font-mono font-bold text-xs tracking-[0.2em] uppercase flex items-center gap-2.5 ${
            isSpinning
              ? 'bg-doom-iron border border-red-500/45 text-red-200/90 cursor-not-allowed shadow-[0_0_28px_-6px_rgba(239,68,68,0.5)]'
              : 'cyber-btn'
          }`}
        >
          {isSpinning ? (
            <>
              <RotateCcw size={15} className="animate-spin text-red-400" />
              <span>DECIDING FATE...</span>
            </>
          ) : (
            <span>SPIN WHEEL</span>
          )}
        </button>
      </div>
    </div>
  );
}
