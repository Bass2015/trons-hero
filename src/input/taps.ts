import type { Hand } from '../game/game';

const KEYS: Record<string, Hand> = { v: 'left', n: 'right' };

/**
 * Two touch buttons plus V/N keys. Uses pointerdown so several fingers can
 * hit at once and the tap registers before any click delay.
 */
export function bindTaps(left: HTMLElement, right: HTMLElement, onTap: (hand: Hand) => void): () => void {
  const down = (hand: Hand) => (e: PointerEvent) => {
    e.preventDefault();
    onTap(hand);
  };
  const l = down('left');
  const r = down('right');
  left.addEventListener('pointerdown', l);
  right.addEventListener('pointerdown', r);
  const key = (e: KeyboardEvent) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    const hand = KEYS[e.key.toLowerCase()];
    if (!hand) return;
    e.preventDefault();
    onTap(hand);
  };
  window.addEventListener('keydown', key);
  return () => {
    left.removeEventListener('pointerdown', l);
    right.removeEventListener('pointerdown', r);
    window.removeEventListener('keydown', key);
  };
}
