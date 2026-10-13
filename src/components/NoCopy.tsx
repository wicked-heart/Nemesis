import { useEffect } from 'react';

// Players can't copy the clues out (to paste them into a chatbot) or paste an answer in. UI only:
// while a player screen is showing it blocks copy / cut / paste (keys, right-click menu, phone
// long-press), dragging text, selecting text, select-all, saving and printing the page.
// Typing still works. The admin screens don't mount it.

const BLOCKED_KEYS = new Set(['c', 'x', 'v', 'a', 's', 'p']);
const PASTE_INPUTS = new Set(['insertFromPaste', 'insertFromPasteAsQuotation', 'insertFromDrop', 'insertFromYank']);

const isField = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');

export default function NoCopy() {
  useEffect(() => {
    const root = document.documentElement;
    const block = (e: Event) => e.preventDefault();
    const keys = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      // Ctrl/Cmd + C, X, V, S, P; Ctrl+A too, except inside the text box (selects what you typed).
      if ((e.ctrlKey || e.metaKey) && BLOCKED_KEYS.has(key) && !(key === 'a' && isField(e.target))) e.preventDefault();
      // Windows: Ctrl+Insert copies, Shift+Insert pastes.
      if (e.key === 'Insert' && (e.ctrlKey || e.shiftKey)) e.preventDefault();
    };
    // Phone keyboards can paste from their clipboard bar without a paste event.
    const typing = (e: Event) => {
      if (PASTE_INPUTS.has((e as InputEvent).inputType)) e.preventDefault();
    };
    const select = (e: Event) => {
      if (!isField(e.target)) e.preventDefault();
    };
    const listeners: [string, (e: Event) => void][] = [
      ['copy', block],
      ['cut', block],
      ['paste', block],
      ['contextmenu', block],
      ['dragstart', block],
      ['drop', block],
      ['selectstart', select],
      ['beforeinput', typing],
      ['keydown', keys as (e: Event) => void],
    ];
    root.classList.add('no-copy');
    window.getSelection()?.removeAllRanges();
    listeners.forEach(([type, fn]) => document.addEventListener(type, fn, true));
    return () => {
      root.classList.remove('no-copy');
      listeners.forEach(([type, fn]) => document.removeEventListener(type, fn, true));
    };
  }, []);
  return null;
}
