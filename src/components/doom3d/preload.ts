import { DOOM_MODEL_URL } from './config';
import { hasWebGL } from './quality';

/** Start downloading the 3D code and the mask model early (e.g. while the player is on another screen). */
export function preloadDoom() {
  if (!hasWebGL()) return;
  import('./DoomScene').catch(() => {});
  fetch(DOOM_MODEL_URL).catch(() => {});
}
