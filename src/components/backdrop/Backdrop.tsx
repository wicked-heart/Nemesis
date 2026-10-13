import { useEffect, useRef } from 'react';

// The NEMESIS background for every screen (UI only, no words): the AI&DS Club site's moving dot
// background (its components/flow-background.tsx), in dark graphite with a hint of Doom green.
// A grid of dots with a slow liquid of light flowing through it, drawn by the graphics chip, so it
// stays sharp on every screen, loads instantly and reacts to the finger / cursor.
//
// Two passes keep it cheap on phones:
//   1. the flowing liquid is worked out once per dot (a tiny image, one pixel per dot)
//   2. each dot is drawn with a size and colour from that tiny image.
//
// It also paints the colour behind the dots. `stage` (Landing): a soft studio gradient with the dots
// fading away in the middle, so Doom sits on a clean backdrop (like the club's hero stage). Otherwise a
// plain page colour with the dots strongest in the middle. The lock screen borrows it as a "corrupted
// signal": red dots, rows tearing sideways, a scan band rolling down (<BackdropSlot corrupt />).
//
// There is only ONE background canvas for the whole app: building it (a graphics context and its
// shaders) froze the page for a moment on every screen change, so it is built once and each screen just
// tells it which look to use. If WebGL is unavailable the plain page colour on <html> shows instead.

type Variant = 'stage' | 'page' | 'calm' | 'corrupt';
type Palette = { low: string; mid: string; high: string; alpha: number };

const PALETTES: Record<Variant, Palette> = {
  stage: { low: '#191c1a', mid: '#2a302c', high: '#4a6352', alpha: 0.65 },
  page: { low: '#191c1a', mid: '#2a302c', high: '#4a6352', alpha: 0.65 },
  // The quieter version for the game screen and the admin console.
  calm: { low: '#191c1a', mid: '#2a302c', high: '#4a6352', alpha: 0.45 },
  // The lock screen: Doom's red.
  corrupt: { low: '#1d0f12', mid: '#3a151b', high: '#ff4d5e', alpha: 0.72 },
};
// Colour behind the dots: studio gradient (centre, middle, edges) or a plain colour.
const BACKS: Record<Variant, string[]> = {
  stage: ['#1a1f1c', '#101411', '#090b0a'],
  page: ['#0a0c0b', '#0a0c0b', '#0a0c0b'],
  calm: ['#0a0c0b', '#0a0c0b', '#0a0c0b'],
  corrupt: ['#1c0b0e', '#0d0607', '#050304'],
};

const vertex = /* glsl */ `
  attribute vec2 aPos;
  void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

// Older phones may not support high precision in this step; fall back gracefully.
const precision = /* glsl */ `
#ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
#else
  precision mediump float;
#endif
`;

// Simplex noise: Ian McEwan, Ashima Arts (MIT licence), from github.com/ashima/webgl-noise
const noise = /* glsl */ `
  vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  float fbm(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
      s += a * snoise(p);
      p = p * 2.03 + vec2(3.1, 1.7);
      a *= 0.5;
    }
    return s;
  }
`;

// Pass 1: one pixel per dot = how bright the liquid is there (0..1).
const flowFragment = /* glsl */ `
  ${precision}
  uniform float uTime;
  uniform float uCell;
  uniform vec2 uRes;
  uniform vec3 uPointer;
  ${noise}
  void main() {
    vec2 centre = (floor(gl_FragCoord.xy) + 0.5) * uCell;
    vec2 p = centre / uRes.y * 0.75;
    float t = uTime * 0.045;
    vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3 - t)));
    vec2 r = vec2(fbm(p + 1.4 * q + vec2(1.7 - t, 9.2)), fbm(p + 1.4 * q + vec2(8.3, 2.8 + t)));
    float f = fbm(p + 1.3 * r);
    // Wide silky ribbons, like light moving over liquid.
    float ribbons = 0.5 + 0.5 * sin(5.5 * (f + 0.6 * r.x) - uTime * 0.18);
    float v = pow(ribbons, 3.0) * (0.35 + 0.65 * smoothstep(-0.45, 0.35, f));
    // A soft glow follows the finger / cursor.
    vec2 d = centre - uPointer.xy;
    v += uPointer.z * 0.6 * exp(-dot(d, d) / (2.0 * 130.0 * 130.0));
    gl_FragColor = vec4(clamp(v, 0.0, 1.0), 0.0, 0.0, 1.0);
  }
`;

// Pass 2: draw each dot, sized and coloured by the liquid, over the backdrop colour.
const dotFragment = /* glsl */ `
  ${precision}
  uniform sampler2D uFlow;
  uniform vec2 uGrid;
  uniform vec2 uRes;
  uniform float uCell;
  uniform float uDpr;
  uniform float uTime;
  uniform vec3 uLow;
  uniform vec3 uMid;
  uniform vec3 uHigh;
  uniform float uAlpha;
  // 1: studio stage backdrop, 2: plain colour.
  uniform float uBackdrop;
  uniform vec3 uBackA;
  uniform vec3 uBackB;
  uniform vec3 uBackC;
  // 1 on the lock screen: the signal is corrupted.
  uniform float uCorrupt;
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  void main() {
    vec2 css = gl_FragCoord.xy / uDpr;
    vec2 at = css;
    float tick = floor(uTime * 7.0);
    if (uCorrupt > 0.5) {
      // Rows of dots tear sideways for a moment, like a broken transmission.
      float row = floor(css.y / 14.0);
      float n = hash(row * 12.9898 + tick * 78.233);
      at.x += step(0.9, n) * (hash(n * 91.7) - 0.5) * 260.0;
    }
    vec2 cell = floor(at / uCell);
    float v = texture2D(uFlow, (cell + 0.5) / uGrid).r;
    if (uCorrupt > 0.5) {
      // A bright scan band rolls down the screen; a few dots drop out.
      float y = 1.0 - css.y / uRes.y;
      float scan = exp(-pow((y - fract(uTime * 0.11)) * 16.0, 2.0));
      v = max(v, scan * 0.85);
      v *= 1.0 - step(0.985, hash(dot(cell, vec2(12.9898, 78.233)) + tick));
    }
    vec2 centre = (cell + 0.5) * uCell;
    float radius = uCell * 0.5 * (0.14 + 0.8 * sqrt(v));
    float aa = 0.8;
    float mask = 1.0 - smoothstep(radius - aa, radius + aa, length(at - centre));
    vec3 col = v < 0.5 ? mix(uLow, uMid, v * 2.0) : mix(uMid, uHigh, v * 2.0 - 1.0);
    vec2 uv = css / uRes - 0.5;
    float vignette = 1.0 - smoothstep(0.25, 0.95, length(uv * vec2(1.05, 1.15)));
    // The lock screen keeps its dots right out to the edges, top to bottom.
    vignette = mix(vignette, 0.7 + 0.3 * vignette, uCorrupt);
    float a = mask * uAlpha * (0.16 + 0.84 * v) * vignette;
    // The whole signal flickers now and then on the lock screen.
    a *= 1.0 - uCorrupt * 0.35 * step(0.92, hash(tick * 3.17));
    vec3 back = uBackA;
    if (uBackdrop < 1.5) {
      // Measured from the top-left, like CSS.
      vec2 p = vec2(css.x, uRes.y - css.y);
      // radial-gradient(120% 95% at 50% 58%, A 0%, B 55%, C 100%)
      float g = length((p - uRes * vec2(0.5, 0.58)) / (uRes * vec2(1.2, 0.95)));
      back = g < 0.55 ? mix(uBackA, uBackB, g / 0.55) : mix(uBackB, uBackC, min((g - 0.55) / 0.45, 1.0));
      // Dots fade out in the middle: radial-gradient(ellipse 62% 58% at 50% 60%, transparent 35%, black 85%)
      // (not on the lock screen: there the corrupted signal fills the whole screen).
      float e = length((p - uRes * vec2(0.5, 0.6)) / (uRes * vec2(0.62, 0.58)));
      a *= mix(clamp((e - 0.35) / 0.5, 0.0, 1.0), 1.0, uCorrupt);
    }
    // A touch of noise so the soft gradient never shows bands (browsers do the same for CSS gradients).
    back += (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;
    gl_FragColor = vec4(back * (1.0 - a) + col * a, 1.0);
  }
`;

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl: WebGLRenderingContext, fragment: string) {
  const program = gl.createProgram()!;
  for (const [type, src] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'shader error');
    gl.attachShader(program, shader);
  }
  gl.bindAttribLocation(program, 0, 'aPos');
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link error');
  return program;
}

// ---------------------------------------------------------------------------
// The one background canvas (built on first use, kept for the whole visit)
// ---------------------------------------------------------------------------

type Claim = { variant: Variant; slot: HTMLElement | null };

const claims = new Map<number, Claim>();
const order: number[] = [];
let nextId = 1;
let engine: { canvas: HTMLCanvasElement; place: () => void; play: () => void } | null = null;
let broken = false;

const topClaim = () => (order.length ? claims.get(order[order.length - 1]) : undefined);

function startEngine() {
  if (engine || broken) return;
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false });
  if (!gl) {
    broken = true;
    return;
  }

  const touch = window.matchMedia('(pointer: coarse)').matches;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cellSize = 9;
  const speed = 0.8;
  // Phones redraw 30 times a second (the liquid is slow, so it looks the same and saves battery).
  const frameMs = touch ? 1000 / 30 : 1000 / 60;

  let flowProgram: WebGLProgram;
  let dotProgram: WebGLProgram;
  try {
    flowProgram = compile(gl, flowFragment);
    dotProgram = compile(gl, dotFragment);
  } catch {
    broken = true; // Leave the plain page colour if the device can't run it.
    return;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  const u = (program: WebGLProgram, name: string) => gl.getUniformLocation(program, name);
  const flowU = { time: u(flowProgram, 'uTime'), cell: u(flowProgram, 'uCell'), res: u(flowProgram, 'uRes'), pointer: u(flowProgram, 'uPointer') };
  const dotU = {
    grid: u(dotProgram, 'uGrid'),
    res: u(dotProgram, 'uRes'),
    cell: u(dotProgram, 'uCell'),
    dpr: u(dotProgram, 'uDpr'),
    time: u(dotProgram, 'uTime'),
    low: u(dotProgram, 'uLow'),
    mid: u(dotProgram, 'uMid'),
    high: u(dotProgram, 'uHigh'),
    alpha: u(dotProgram, 'uAlpha'),
    backdrop: u(dotProgram, 'uBackdrop'),
    corrupt: u(dotProgram, 'uCorrupt'),
    back: ['uBackA', 'uBackB', 'uBackC'].map((name) => u(dotProgram, name)),
  };

  const size = { w: 1, h: 1, dpr: 1, cols: 1, rows: 1 };
  const pointer = { x: -9999, y: -9999, on: 0, target: 0 };
  let raf = 0;
  let last = 0;
  const start = performance.now();

  const resize = () => {
    size.w = Math.max(1, window.innerWidth);
    size.h = Math.max(1, window.innerHeight);
    size.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size.w * size.dpr);
    canvas.height = Math.round(size.h * size.dpr);
    size.cols = Math.ceil(size.w / cellSize) + 1;
    size.rows = Math.ceil(size.h / cellSize) + 1;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size.cols, size.rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  const draw = (now: number) => {
    const claim = topClaim();
    if (!claim) return;
    const variant = claim.variant;
    const pal = PALETTES[variant];
    const time = reduced ? 20 : ((now - start) / 1000) * speed;
    pointer.on += (pointer.target - pointer.on) * 0.08;

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.viewport(0, 0, size.cols, size.rows);
    gl.useProgram(flowProgram);
    gl.uniform1f(flowU.time, time);
    gl.uniform1f(flowU.cell, cellSize);
    gl.uniform2f(flowU.res, size.w, size.h);
    gl.uniform3f(flowU.pointer, pointer.x, pointer.y, pointer.on);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(dotProgram);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform2f(dotU.grid, size.cols, size.rows);
    gl.uniform2f(dotU.res, size.w, size.h);
    gl.uniform1f(dotU.cell, cellSize);
    gl.uniform1f(dotU.dpr, size.dpr);
    gl.uniform1f(dotU.time, reduced ? 0 : (now - start) / 1000);
    gl.uniform3f(dotU.low, ...hexToRgb(pal.low));
    gl.uniform3f(dotU.mid, ...hexToRgb(pal.mid));
    gl.uniform3f(dotU.high, ...hexToRgb(pal.high));
    gl.uniform1f(dotU.alpha, pal.alpha);
    gl.uniform1f(dotU.backdrop, variant === 'stage' || variant === 'corrupt' ? 1 : 2);
    gl.uniform1f(dotU.corrupt, variant === 'corrupt' ? 1 : 0);
    BACKS[variant].forEach((c, i) => gl.uniform3f(dotU.back[i], ...hexToRgb(c)));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (now - last < frameMs - 2) return;
    last = now;
    draw(now);
  };
  const play = () => {
    cancelAnimationFrame(raf);
    if (!topClaim()) return;
    if (reduced) draw(performance.now());
    else if (!document.hidden) raf = requestAnimationFrame(loop);
  };

  // Put the canvas where the current screen wants it: behind the page, or inside the lock screen.
  const place = () => {
    const claim = topClaim();
    if (!claim) {
      canvas.remove();
      return;
    }
    const target = claim.slot ?? document.body;
    canvas.style.cssText = claim.slot
      ? 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none'
      : 'position:fixed;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:-1';
    if (canvas.parentElement !== target) {
      if (claim.slot) target.prepend(canvas);
      else target.appendChild(canvas);
    }
    draw(performance.now());
  };

  resize();
  window.addEventListener('resize', () => {
    resize();
    draw(performance.now());
  });
  document.addEventListener('visibilitychange', play);

  // Follow the finger / cursor anywhere on the page, even over panels (passive, never blocks scrolling).
  const move = (e: PointerEvent) => {
    pointer.x = e.clientX;
    pointer.y = size.h - e.clientY; // the shader counts from the bottom
    pointer.target = 1;
    if (reduced) draw(performance.now());
  };
  const leave = () => {
    pointer.target = 0;
  };
  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('pointerdown', move, { passive: true });
  document.documentElement.addEventListener('pointerleave', leave, { passive: true });
  window.addEventListener('pointercancel', leave, { passive: true });
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    cancelAnimationFrame(raf);
    broken = true;
    canvas.remove();
  });

  engine = { canvas, place, play };
}

function claimBackdrop(claim: Claim) {
  startEngine();
  const id = nextId++;
  claims.set(id, claim);
  order.push(id);
  engine?.place();
  engine?.play();
  return id;
}

function releaseBackdrop(id: number) {
  if (!claims.delete(id)) return;
  order.splice(order.indexOf(id), 1);
  engine?.place();
  engine?.play();
}

// Cursor spotlight on the panel under the pointer (see .terminal-panel in index.css), and "magnetic"
// buttons that lean a few pixels towards the cursor (.cyber-btn). One listener for the whole app.
let spotlight = false;
function startSpotlight() {
  if (spotlight) return;
  spotlight = true;
  const magnetic = window.matchMedia('(hover: hover) and (pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastButton: HTMLElement | null = null;
  window.addEventListener(
    'pointermove',
    (e) => {
      const target = e.target as Element | null;
      const panel = target?.closest?.('.terminal-panel, .doom-feature-card') as HTMLElement | null;
      if (panel) {
        const r = panel.getBoundingClientRect();
        panel.style.setProperty('--mx', `${e.clientX - r.left}px`);
        panel.style.setProperty('--my', `${e.clientY - r.top}px`);
      }
      if (!magnetic) return;
      const button = target?.closest?.('.cyber-btn:not(:disabled)') as HTMLElement | null;
      if (lastButton && lastButton !== button) {
        lastButton.style.removeProperty('--bx');
        lastButton.style.removeProperty('--by');
      }
      lastButton = button;
      if (button) {
        const r = button.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        button.style.setProperty('--bx', `${(dx * 4).toFixed(1)}px`);
        button.style.setProperty('--by', `${(dy * 3).toFixed(1)}px`);
      }
    },
    { passive: true },
  );
}

/**
 * The page background (behind everything).
 * calm: quieter dots (game screen and admin). stage: studio gradient with a clear middle (Landing).
 */
export default function Backdrop({ calm = false, stage = false }: { calm?: boolean; stage?: boolean }) {
  useEffect(() => {
    startSpotlight();
    const id = claimBackdrop({ variant: stage ? 'stage' : calm ? 'calm' : 'page', slot: null });
    return () => releaseBackdrop(id);
  }, [calm, stage]);
  return null;
}

/** The lock screen's background: the same canvas, moved inside the lock screen as a corrupted signal. */
export function BackdropSlot({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const slot = ref.current;
    if (!slot) return;
    const id = claimBackdrop({ variant: 'corrupt', slot });
    return () => releaseBackdrop(id);
  }, []);
  return <div ref={ref} aria-hidden className={`pointer-events-none ${className}`} />;
}
