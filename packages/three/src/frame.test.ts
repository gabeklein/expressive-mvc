import { describe, expect, it, vi } from 'vitest';

import { Frame, loop } from './frame';

/** Manual scheduler - collects the pending step so a test can drive it. */
function scheduler() {
  let next: ((time: number) => void) | undefined;

  return {
    schedule(step: (time: number) => void) {
      next = step;
    },
    advance(time: number) {
      const step = next;
      next = undefined;
      step!(time);
    },
    get pending() {
      return next !== undefined;
    }
  };
}

describe('Frame', () => {
  it('will run handlers with delta and elapsed', () => {
    const frame = Frame.new();
    const seen: [number, number][] = [];

    frame.each((delta, elapsed) => seen.push([delta, elapsed]));

    frame.tick(0.5);
    frame.tick(0.25);

    expect(seen).toEqual([
      [0.5, 0.5],
      [0.25, 0.75]
    ]);
  });

  it('will stop a handler', () => {
    const frame = Frame.new();
    const handler = vi.fn();
    const stop = frame.each(handler);

    frame.tick(1);
    stop();
    frame.tick(1);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('will not dispatch an update per frame', async () => {
    const frame = Frame.new();
    const handler = vi.fn();

    frame.each(handler);
    frame.tick(1);

    await expect(frame).not.toHaveUpdated();
    expect(handler).toHaveBeenCalled();
  });
});

describe('loop', () => {
  it('will drive a frame from a scheduler', () => {
    const clock = scheduler();
    const frame = Frame.new();
    const seen: number[] = [];

    frame.each((delta) => seen.push(delta));

    loop(frame, clock.schedule);

    clock.advance(1000);
    clock.advance(1500);

    expect(seen).toEqual([0, 0.5]);
  });

  it('will stop scheduling', () => {
    const clock = scheduler();
    const frame = Frame.new();
    const handler = vi.fn();

    frame.each(handler);

    const stop = loop(frame, clock.schedule);

    clock.advance(1000);
    stop();
    clock.advance(2000);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(clock.pending).toBe(false);
  });
});
