import { State } from '@expressive/mvc';

declare namespace Frame {
  type Handler = (delta: number, elapsed: number) => void;
  type Schedule = (step: (time: number) => void) => void;
}

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

  protected _handlers = new Set<Frame.Handler>();
  protected _elapsed = 0;

  /** Run `handler` every frame. Returns a function to stop. */
  each(handler: Frame.Handler) {
    this._handlers.add(handler);

    return () => {
      this._handlers.delete(handler);
    };
  }

  /** Advance the clock by `delta` seconds and run every handler. */
  tick(delta: number) {
    this._elapsed += delta;

    for (const handler of this._handlers) handler(delta, this._elapsed);
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
