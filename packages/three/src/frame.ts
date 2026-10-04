import { State } from '@expressive/mvc';

declare namespace Frame {
  type Handler = (delta: number, elapsed: number) => void;
  type Schedule = (step: (time: number) => void) => void;
}

/** Animation clock - provide one, read it with `get(Frame)`. */
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

/** Drive `frame` from a scheduler, e.g. `requestAnimationFrame`. Returns a function to stop. */
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
