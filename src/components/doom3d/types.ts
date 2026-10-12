// Shared between the page (which reads the pointer and typing) and the 3D mask. UI only.

/**
 * watch : Landing, Entry and the game screen — follows the cursor, eyes flare while you type
 * mask  : admin login and small spots — the same, a little calmer
 * judge : wrong-guess lock screen — red eyes, leaning in
 * win   : round won — raised, bright eyes
 * lose  : time-out / failed — turned away, dim
 */
export type DoomMode = 'watch' | 'mask' | 'judge' | 'win' | 'lose';

export type DoomInput = {
  /** Cursor / finger, -1..1 across the window. */
  pointer: { x: number; y: number; active: boolean };
  /** performance.now() of the last keystroke in a text field (eyes flare). */
  pulse: number;
  /** performance.now() of the last form submit (eyes flash). */
  flash: number;
  /** Landing: the Rules window is open (the mask judges you: red eyes, leaning in). */
  alert: boolean;
};

export const makeDoomInput = (): DoomInput => ({
  pointer: { x: 0, y: 0, active: false },
  pulse: -1e9,
  flash: -1e9,
  alert: false,
});
