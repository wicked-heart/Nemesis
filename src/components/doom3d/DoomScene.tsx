// The 3D scene (loaded on demand): the Doom mask (see maskModel.ts) in a dark studio. It rises into place and its eyes
// ignite, then floats gently and turns towards the cursor; each screen sets a mood (eye colour, tilt).
// All movement happens in useFrame by changing three.js objects directly (no React re-renders),
// smoothed with damping. UI only: it reads the page, never changes it.

import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Component, Suspense, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { DOOM_MODEL_URL } from './config';
import { MASK, glowTexture, prepareMask, type MaskModel } from './maskModel';
import type { Quality } from './quality';
import type { DoomInput, DoomMode } from './types';

const FOV = 30;
const CAMERA_Z = 14;
const VISIBLE_H = 2 * CAMERA_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const GREEN = new THREE.Color('#39ff88');
const RED = new THREE.Color('#ff2b3b');
// Where the eye glow sits (relative to the eyelids): in front of Doom's head, inside the mask's eye openings.
const EYE_DEPTH = 0;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeOut = (t: number) => 1 - (1 - clamp01(t)) ** 3;
const damp = THREE.MathUtils.damp;

/** Glow that only adds light: it never writes the canvas alpha, so the page behind stays visible. */
function glowBlend<T extends THREE.Material>(m: T) {
  m.blending = THREE.CustomBlending;
  m.blendEquation = THREE.AddEquation;
  m.blendSrc = THREE.SrcAlphaFactor;
  m.blendDst = THREE.OneFactor;
  m.blendSrcAlpha = THREE.ZeroFactor;
  m.blendDstAlpha = THREE.OneFactor;
  m.depthWrite = false;
  m.transparent = true;
  return m;
}

// ---------------------------------------------------------------------------
// Moods: a handful of numbers the mask eases towards.
// ---------------------------------------------------------------------------

type Pose = {
  turn: number; // yaw (radians)
  tilt: number; // head up (-) / down (+)
  lean: number; // towards the viewer
  eyes: number; // eye glow
  red: number; // 0 green .. 1 red
  halo: number; // glow behind the mask
  dim: number; // lights down (failure)
};
const POSE_KEYS: (keyof Pose)[] = ['turn', 'tilt', 'lean', 'eyes', 'red', 'halo', 'dim'];
const BASE: Pose = { turn: 0, tilt: 0, lean: 0, eyes: 1, red: 0, halo: 1, dim: 0 };
const JUDGED: Pose = { ...BASE, lean: 0.35, red: 1, eyes: 1.5, halo: 1.3, tilt: 0.07 };

const MOODS: Record<DoomMode, Pose> = {
  watch: BASE,
  mask: { ...BASE, eyes: 0.95 },
  judge: JUDGED,
  win: { ...BASE, tilt: -0.1, eyes: 1.6, halo: 1.5 },
  lose: { ...BASE, turn: 0.55, tilt: 0.16, eyes: 0.3, red: 0.7, halo: 0.2, dim: 0.5 },
};

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

export type DoomSceneProps = {
  input: React.MutableRefObject<DoomInput>;
  mode: DoomMode;
  quality: Quality;
  reduced: boolean;
  running: boolean;
  /** Goes up each time the scene moves to another Doom box (see stage.tsx): replays the entrance. */
  entrance: number;
  onReady: () => void;
  onLost: () => void;
};

export default function DoomScene(props: DoomSceneProps) {
  const { quality, reduced, running, onLost } = props;
  return (
    <Canvas
      dpr={quality.maxDpr}
      frameloop={running ? (reduced ? 'demand' : 'always') : 'never'}
      gl={{ antialias: quality.antialias, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: FOV, near: 0.1, far: 80, position: [0, 0, CAMERA_Z] }}
      style={{ pointerEvents: 'none' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1;
        gl.setClearColor(0x000000, 0);
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          onLost();
        });
      }}
    >
      <Studio />
      <ModelBoundary onFail={onLost}>
        <Suspense fallback={null}>
          <GltfMask {...props} url={DOOM_MODEL_URL} />
        </Suspense>
      </ModelBoundary>
    </Canvas>
  );
}

/**
 * Reflections for the metal: a dark photo studio built in code (nothing to download). A black room
 * with a big soft-box overhead, two tall strip lights at the sides and green strips behind, so the
 * painted steel reads as metal: mostly dark, with soft bright highlights along the plate edges.
 */
function studioScene() {
  const room = new THREE.Scene();
  room.background = new THREE.Color(0x060706);
  const box = (w: number, h: number, colour: string, power: number, pos: [number, number, number], look: [number, number, number] = [0, 0, 0]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(colour).multiplyScalar(power), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(...look);
    room.add(m);
  };
  box(9, 3, '#ffffff', 3.2, [0, 7, 3]); // overhead soft-box
  box(1.6, 9, '#eef4f8', 2.2, [-7, 0.5, 2]); // left strip
  box(1.6, 9, '#eef4f8', 1.6, [7, 0.5, 2]); // right strip
  box(6, 1.2, '#dfe9e3', 0.7, [0, -4, 6]); // low fill bounce
  box(1.2, 8, '#39ff88', 0.7, [-5, 1, -6]); // green strips behind
  box(1.2, 8, '#39ff88', 0.5, [5, 1, -6]);
  return room;
}

function Studio() {
  const { gl, scene } = useThree();
  useLayoutEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(studioScene(), 0.02).texture;
    // Rendering the studio leaves its black background as the clear colour: put back "see-through",
    // or the canvas would paint a dark box over the page's background.
    gl.setClearColor(0x000000, 0);
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

/** The mask model (public/models/doom-mask.glb, see config.ts). */
function GltfMask({ url, ...props }: DoomSceneProps & { url: string }) {
  const gltf = useLoader(GLTFLoader, url);
  const model = useMemo(() => prepareMask(gltf.scene), [gltf]);
  return <Mask {...props} model={model} />;
}

/** If the .glb is missing or broken, the page keeps showing the flat SVG mask instead. */
class ModelBoundary extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('NEMESIS: the Doom mask model could not be loaded, showing the flat mask instead.', error);
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// ---------------------------------------------------------------------------
// The mask
// ---------------------------------------------------------------------------

function Mask({ input, mode, quality, reduced, entrance, onReady, model }: DoomSceneProps & { model: MaskModel }) {
  const { gl, scene, camera } = useThree();
  const invalidate = useThree((s) => s.invalidate);
  const setDpr = useThree((s) => s.setDpr);
  const perf = useMemo(() => ({ avg: 1 / 60, n: 0, dpr: quality.maxDpr }), [quality.maxDpr]);
  const root = useRef<THREE.Group>(null!);
  const haloGroup = useRef<THREE.Group>(null!);
  const rim = useRef<THREE.DirectionalLight>(null!);
  const rim2 = useRef<THREE.DirectionalLight>(null!);
  const key = useRef<THREE.DirectionalLight>(null!);
  const eyeLight = useRef<THREE.PointLight>(null!);

  // --- materials (built once) ---
  const mats = useMemo(() => {
    const glowTex = glowTexture();
    // A soft light filling each eye slit from inside.
    const eye = glowBlend(new THREE.MeshBasicMaterial({ map: glowTex, color: GREEN.clone(), toneMapped: false }));
    const halo = glowBlend(new THREE.SpriteMaterial({ map: glowTex, color: GREEN.clone(), opacity: 0.4 }));
    const eyeCore = glowBlend(new THREE.SpriteMaterial({ map: glowTex, color: GREEN.clone(), opacity: 1 }));
    const eyeGlow = glowBlend(new THREE.SpriteMaterial({ map: glowTex, color: GREEN.clone(), opacity: 0.8 }));
    return { eye, halo, eyeCore, eyeGlow };
  }, []);

  const smallGeo = useMemo(() => ({ eye: new THREE.PlaneGeometry(1, 1) }), []);
  // The eye glow's size follows the distance between Doom's eyes.
  const fit = useMemo(() => {
    const eyeW = Math.abs(model.eyes[1].x - model.eyes[0].x) * 0.62;
    return { eye: [eyeW, eyeW * 0.42, 1] as [number, number, number] };
  }, [model]);

  const pose = useMemo<Pose>(() => ({ ...BASE, eyes: 0 }), []);
  const target = useMemo<Pose>(() => ({ ...BASE }), []);
  const state = useMemo(() => ({ start: -1, frames: 0, flare: 0, live: false, entrance: -1 }), []);

  // Before Doom first appears, compile his shaders in the background and upload his textures one per
  // frame, so the first frames never freeze the page.
  useLayoutEffect(() => {
    const g = root.current;
    let alive = true;
    const textures = new Set<THREE.Texture>();
    g.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (!m || !(o as THREE.Mesh).isMesh) return;
      for (const t of [m.map, m.normalMap, m.roughnessMap, m.metalnessMap, m.aoMap, m.emissiveMap]) if (t) textures.add(t);
    });
    const compiled = gl.compileAsync(scene, camera);
    g.visible = false;
    compiled
      .catch(() => {})
      .then(async () => {
        for (const t of textures) {
          if (!alive) return;
          gl.initTexture(t);
          await new Promise((r) => requestAnimationFrame(r));
        }
        if (!alive) return;
        g.visible = true;
        state.live = true;
        state.start = -1;
      });
    return () => {
      alive = false;
    };
  }, [gl, scene, camera, state]);
  const colour = useMemo(() => new THREE.Color(), []);

  useFrame((three, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const t = three.clock.elapsedTime;
    const now = performance.now();
    // If this device struggles, draw at a lower resolution (checked every 2 seconds or so).
    perf.avg = perf.avg * 0.95 + delta * 0.05;
    if (++perf.n % 120 === 0 && perf.avg > 1 / 40 && perf.dpr > 0.8) {
      perf.dpr = Math.max(0.75, perf.dpr - 0.25);
      setDpr(perf.dpr);
    }
    if (!state.live) return;
    const inp = input.current;
    // Moved to another Doom box: replay the entrance (rise in, eyes ignite).
    if (state.entrance !== entrance) {
      state.entrance = entrance;
      state.start = t;
    }
    if (state.start < 0) state.start = t;
    const age = t - state.start;
    if (++state.frames === 3) onReady();

    // --- intro: the mask rises into place and turns to face you, then the eyes ignite ---
    const rise = reduced ? 1 : easeOut(age / 1.6);
    const ignite = reduced ? 1 : smooth(1.0, 1.7, age);

    // --- target mood (the Rules window on the Landing page makes the mask judge you) ---
    Object.assign(target, inp.alert ? JUDGED : MOODS[mode]);
    for (const k of POSE_KEYS) pose[k] = reduced ? target[k] : damp(pose[k], target[k], 4.5, dt);

    // Typing makes the eyes flare; a submit flashes them.
    const sincePulse = (now - inp.pulse) / 1000;
    const sinceFlash = (now - inp.flash) / 1000;
    state.flare = Math.max(Math.exp(-sincePulse * 5) * 0.6, Math.exp(-sinceFlash * 2.5) * 1.6);

    // --- size and place: Doom fills most of the canvas (by height, or by width on narrow canvases) ---
    const visibleW = VISIBLE_H * (three.size.width / Math.max(1, three.size.height));
    const scale = Math.min((VISIBLE_H * 0.88) / (MASK.top - MASK.bottom), (visibleW * 0.94) / model.size.x);
    const g = root.current;
    const float = reduced ? 0 : Math.sin(t * 0.8) * 0.03;
    const centre = -((MASK.top + MASK.bottom) / 2) * scale;
    g.position.set(0, centre + (float - (1 - rise) * 0.3) * scale - pose.lean * 0.15 * scale, pose.lean * 1.4);
    g.scale.setScalar(scale * (0.94 + 0.06 * rise) * (1 + pose.lean * 0.06));
    // The glow behind the mask fades out fully inside the canvas (a cut-off glow shows as a box).
    const aspect = three.size.width / Math.max(1, three.size.height);
    haloGroup.current.position.set(0, 0, -1.6);
    haloGroup.current.scale.setScalar(Math.min(VISIBLE_H, VISIBLE_H * aspect) * 0.92);

    // --- turning: mood + gentle sway + following the cursor ---
    const follow = mode === 'judge' ? 0.15 : mode === 'lose' ? 0.06 : 0.45;
    const px = inp.pointer.active ? inp.pointer.x : 0;
    const py = inp.pointer.active ? inp.pointer.y : 0;
    const sway = reduced ? 0 : Math.sin(t * 0.33) * 0.07;
    const yaw = pose.turn + sway + px * follow + (1 - rise) * 0.7;
    g.rotation.y = reduced ? yaw : damp(g.rotation.y, yaw, 3.2, dt);
    const pitch = pose.tilt - py * follow * 0.4 + (reduced ? 0 : Math.sin(t * 0.21) * 0.025);
    g.rotation.x = reduced ? pitch : damp(g.rotation.x, pitch, 3.2, dt);

    // --- eyes, glow and light colours ---
    const flicker = reduced ? 1 : 0.92 + 0.08 * Math.sin(t * 23) * Math.sin(t * 7.3);
    const eyePower = pose.eyes * ignite * flicker + state.flare;
    colour.copy(GREEN).lerp(RED, pose.red);
    mats.eye.color.copy(colour);
    mats.eye.opacity = clamp01(0.15 + eyePower * 0.85);
    mats.eyeCore.color.copy(colour);
    mats.eyeGlow.color.copy(colour);
    mats.eyeCore.opacity = clamp01(eyePower * 0.8);
    mats.eyeGlow.opacity = clamp01(eyePower * 0.35);
    mats.halo.color.copy(colour);
    mats.halo.opacity = clamp01(0.06 + pose.halo * 0.16 * ignite + state.flare * 0.12);
    eyeLight.current.color.copy(colour);
    eyeLight.current.intensity = eyePower * 1.2;
    rim.current.color.copy(colour);
    rim2.current.color.copy(colour);
    const rimPower = (1.5 + pose.red * 1.2) * (1 - pose.dim * 0.6) * (0.35 + 0.65 * ignite);
    rim.current.intensity = rimPower;
    rim2.current.intensity = rimPower * 0.75;
    key.current.intensity = 2.5 * (1 - pose.dim * 0.55);

    if (reduced && state.frames < 4) invalidate();
  });

  return (
    <>
      <ambientLight intensity={0.1} />
      <hemisphereLight args={['#dfeee6', '#06120b', 0.32]} />
      <directionalLight ref={key} position={[4.5, 5.5, 6]} intensity={2.5} color="#f6fff9" />
      <directionalLight position={[-6, 1, 4]} intensity={0.4} color="#d6e6ff" />
      <directionalLight ref={rim} position={[-3, 3.5, -6]} intensity={2.6} color="#39ff88" />
      <directionalLight ref={rim2} position={[3.5, 1, -5]} intensity={2} color="#39ff88" />

      {/* Glow behind the mask (not inside the turning group, so it stays centred) */}
      <group ref={haloGroup}>
        <sprite material={mats.halo} />
      </group>

      <group ref={root}>
        {/* Dark inside of the helmet (seen through the eye slits and the vents) */}
        <primitive object={model.root} />
        {model.eyes.map((p, i) => (
          <group key={i} position={p}>
            {/* Deep inside the eye opening, so the iron hides the glow when the mask turns */}
            <mesh geometry={smallGeo.eye} material={mats.eye} scale={fit.eye} position={[0, 0, EYE_DEPTH]} />
            <sprite material={mats.eyeCore} position={[0, 0, EYE_DEPTH + 0.01]} scale={[fit.eye[0] * 0.6, fit.eye[1] * 0.4, 1]} />
            <sprite material={mats.eyeGlow} position={[0, 0, EYE_DEPTH + 0.02]} scale={[fit.eye[0] * 0.95, fit.eye[1] * 0.75, 1]} />
          </group>
        ))}
        <pointLight ref={eyeLight} position={[0, 0.15, 1.1]} distance={3} decay={1.6} intensity={0} />
      </group>
    </>
  );
}
