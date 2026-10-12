import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Quality } from './quality';
import StageRoot from './StageRoot';
import { makeDoomInput, type DoomInput, type DoomMode } from './types';

// One 3D Doom for the whole app (UI only). Building a 3D scene is expensive (a new graphics context,
// shaders, uploading the model's textures), and every page used to build its own: moving from the Landing
// page to the Entry page froze the screen for about half a second. Now the scene is built once and its
// canvas moves into whichever Doom box is on screen (the last one to claim it, e.g. the lock screen over
// the game). Each move replays a short entrance (Doom rises in, eyes ignite).

type Claim = {
  slot: HTMLElement;
  mode: DoomMode;
  input: React.MutableRefObject<DoomInput>;
  running: boolean;
  onReady: () => void;
  onFail: () => void;
};

let host: HTMLDivElement | null = null;
let root: Root | null = null;
let settings: { quality: Quality; reduced: boolean } | null = null;
let nextId = 1;
let ready = false;
let failed = false;
let entrance = 0;
const claims = new Map<number, Claim>();
const order: number[] = [];
const idle = { current: makeDoomInput() };

const top = () => (order.length ? claims.get(order[order.length - 1]) : undefined);

function fail() {
  failed = true;
  for (const c of claims.values()) c.onFail();
}

function sceneReady() {
  ready = true;
  for (const c of claims.values()) c.onReady();
}

function render() {
  if (!root || !host || !settings) return;
  const t = top();
  if (t && host.parentElement !== t.slot) {
    t.slot.appendChild(host);
    entrance++;
  }
  if (!t && host.parentElement) host.remove();
  root.render(
    createElement(StageRoot, {
      input: t?.input ?? idle,
      mode: t?.mode ?? 'watch',
      quality: settings.quality,
      reduced: settings.reduced,
      running: !!t && t.running,
      entrance,
      onReady: sceneReady,
      onLost: fail,
    }),
  );
}

/** A Doom box asks for the 3D. Returns an id for update/release. */
export function claimStage(claim: Claim, quality: Quality, reduced: boolean) {
  if (failed) {
    claim.onFail();
    return 0;
  }
  if (!root) {
    settings = { quality, reduced };
    host = document.createElement('div');
    host.style.cssText = 'position:absolute;inset:0';
    root = createRoot(host);
  }
  const id = nextId++;
  claims.set(id, claim);
  order.push(id);
  render();
  // Already built: show it as soon as the canvas has drawn in its new box.
  if (ready) requestAnimationFrame(() => requestAnimationFrame(() => claims.get(id)?.onReady()));
  return id;
}

export function updateStage(id: number, change: Partial<Pick<Claim, 'mode' | 'running'>>) {
  const c = claims.get(id);
  if (!c) return;
  Object.assign(c, change);
  render();
}

export function releaseStage(id: number) {
  if (!claims.delete(id)) return;
  order.splice(order.indexOf(id), 1);
  render();
}
