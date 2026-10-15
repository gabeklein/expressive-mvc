import { Calendar } from './calendar';

const KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1]
};

/**
 * Arrow keys step focus by month (left/right) and year (up/down).
 *
 * DOM-only: binds `document`. Host-agnostic equivalent needs a key-event seam
 * that canonical elements (#128) do not cover.
 */
export function keyboard(this: Calendar) {
  const keydown = (event: KeyboardEvent) => {
    const step = KEYS[event.key];

    if (!step) return;

    event.preventDefault();
    this.shift(...step);
  };

  document.addEventListener('keydown', keydown);

  this.get(null, () => {
    document.removeEventListener('keydown', keydown);
  });
}
