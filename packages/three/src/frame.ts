import { State } from '@expressive/mvc';

declare namespace Frame {
  type Handler = (delta: number, elapsed: number) => void;
  type Schedule = (step: (time: number) => void) => void;
}

const HANDLERS = new WeakMap<Frame, Set<Frame.Handler>>();
const ELAPSED = new WeakMap<Frame, number>();

/**
 * The animation clock, provided to a scene and read with `get(Frame)`.
 *
 * Registration is deliberately *not* reactive. Per-frame work is imperative by
 * nature - routing it through the observable system would allocate a tracking
 * proxy per object per frame and defer each tick by a microtask. Reactivity
 * belongs to what exists in the graph; the clock belongs to what it does.
 */
class Frame extends State {
  static readonly global = false;

  protected new() {
    HANDLERS.set(this, new Set());
    ELAPSED.set(this, 0);
  }

  /** Run `handler` every frame. Returns a function to stop. */
  each(handler: Frame.Handler) {
    const handlers = HANDLERS.get(this)!;

    handlers.add(handler);

    return () => {
      handlers.delete(handler);
    };
  }

  /** Advance the clock by `delta` seconds and run every handler. */
  tick(delta: number) {
    const elapsed = ELAPSED.get(this)! + delta;

    ELAPSED.set(this, elapsed);

    for (const handler of HANDLERS.get(this)!) handler(delta, elapsed);
  }
}

/**
 * Drive `frame` from a scheduler (`requestAnimationFrame` in a browser).
 * Returns a function to stop.
 */
function loop(frame: Frame, schedule: Frame.Schedule) {
  let last: number | undefined;
  let active = true;

  function step(time: number) {
    if (!active) return;

    frame.tick(last === undefined ? 0 : (time - last) / 1000);
    last = time;
    schedule(step);
  }

  schedule(step);

  return () => {
    active = false;
  };
}

export { Frame, loop };
