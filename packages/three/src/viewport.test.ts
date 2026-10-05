import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

import { PerspectiveCamera } from './camera';
import { Frame } from './frame';
import { Mesh, objectOf, Scene } from './object';
import { Viewport } from './viewport';
import { flushMicrotasks } from '../test.setup';
import { get } from '@expressive/mvc';

const created = vi.hoisted(() => [] as unknown[]);

vi.mock('three', async (actual) => {
  const three = await actual<typeof import('three')>();

  class WebGLRenderer {
    constructor(readonly params: unknown) {
      created.push(params);
    }
    setSize() {}
    setPixelRatio() {}
    render() {}
    dispose() {}
  }

  return { ...three, WebGLRenderer };
});

afterEach(() => {
  vi.unstubAllGlobals();
  created.length = 0;
});

function renderer() {
  return { setSize: vi.fn(), setPixelRatio: vi.fn(), render: vi.fn(), dispose: vi.fn() };
}

function canvas(width = 800, height = 400) {
  return { getContext() {}, clientWidth: width, clientHeight: height } as unknown as HTMLCanvasElement;
}

class Test extends Viewport {
  scene = new Scene();
  camera = new PerspectiveCamera();

  _fake = renderer();
  _steps: ((time: number) => void)[] = [];

  protected createRenderer() {
    return this._fake;
  }

  protected schedule(step: (time: number) => void) {
    this._steps.push(step);
  }

  step(time: number) {
    this._steps.shift()!(time);
  }
}

describe('Viewport', () => {
  it('will draw the scene through its camera after the clock ticks', () => {
    const order: string[] = [];

    class Spinner extends Mesh {
      frame = get(Frame);

      protected new() {
        return this.frame.each((delta) => {
          order.push(`tick ${delta}`);
        });
      }
    }

    class Game extends Test {
      scene = new (class extends Scene {
        spinner = new Spinner();
      })();
    }

    const game = Game.new();
    const render = game._fake.render;

    render.mockImplementation(() => order.push('render'));
    game.attach(canvas());
    game.step(1000);
    game.step(1500);

    expect(order).toEqual(['tick 0', 'render', 'tick 0.5', 'render']);
    expect(render).toHaveBeenCalledWith(objectOf(game.scene), objectOf(game.camera));
  });

  it('will size the renderer and camera to the canvas, and follow resizes', async () => {
    let resized!: () => void;
    const observe = vi.fn();

    vi.stubGlobal('devicePixelRatio', 2);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resized = callback;
        }
        observe = observe;
        disconnect() {}
      }
    );

    const game = Test.new();
    const element = canvas(800, 400);

    game.attach(element);

    expect(observe).toHaveBeenCalledWith(element);
    expect(game._fake.setPixelRatio).toHaveBeenCalledWith(2);
    expect(game._fake.setSize).toHaveBeenCalledWith(800, 400, false);
    expect(game.camera.aspect).toBe(2);

    Object.assign(element, { clientWidth: 300, clientHeight: 300 });
    resized();

    expect(game._fake.setSize).toHaveBeenLastCalledWith(300, 300, false);
    expect(game.camera.aspect).toBe(1);
    await expect(game.camera).toHaveUpdated('aspect');
  });

  it('will size from a WebGL context, leaving a zero height alone', () => {
    class Flat extends Test {
      camera = new PerspectiveCamera();
    }

    const game = Flat.new();
    const gl = { canvas: {}, drawingBufferWidth: 640, drawingBufferHeight: 0 } as unknown as WebGLRenderingContext;

    game.attach(gl);

    expect(game._fake.setSize).toHaveBeenCalledWith(640, 0, false);
    expect(game.camera.aspect).toBe(1);
  });

  it('will not set aspect on a camera without one', () => {
    class Plain extends Mesh {}

    class Odd extends Test {
      camera = new Plain() as never;
    }

    const game = Odd.new();

    game.attach(canvas());

    expect(game._fake.setSize).toHaveBeenCalled();
  });

  it('will stop and dispose when detached', () => {
    const game = Test.new();
    const detach = game.attach(canvas());
    const { dispose } = game._fake;

    detach();
    detach();

    expect(dispose).toHaveBeenCalledTimes(1);

    game.step(0);

    expect(game._fake.render).not.toHaveBeenCalled();
  });

  it('will replace a previous surface', () => {
    const game = Test.new();
    const { dispose } = game._fake;

    game.attach(canvas());
    game.attach(canvas());

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('will attach through a canvas ref while mounted', () => {
    const game = Test.new();
    const { dispose, setSize } = game._fake;

    game.canvas(canvas());
    expect(setSize).toHaveBeenCalled();

    game.canvas(null);
    expect(dispose).toHaveBeenCalled();
  });

  it('will detach when destroyed', () => {
    const game = Test.new();
    const { dispose } = game._fake;

    game.attach(canvas());
    game.set(null);

    expect(dispose).toHaveBeenCalled();
  });

  it('will throw without a scene or camera', () => {
    class Empty extends Viewport {}

    expect(() => Empty.new().attach(canvas())).toThrow(/needs a scene and a camera/);
  });

  it('will restore a node moved through _object before drawing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    class Stray extends Mesh {
      wander(to: THREE.Object3D) {
        to.add(this._object);
      }
    }

    class Game extends Test {
      scene = new (class extends Scene {
        a = new Scene();
        stray = new Stray();
      })();
    }

    const game = Game.new();

    game.attach(canvas());
    game.scene.stray.wander(objectOf(game.scene.a));
    game.step(0);

    expect(objectOf(game.scene.stray).parent).toBe(objectOf(game.scene));
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
    await flushMicrotasks();
  });

  it('will create a WebGL renderer and schedule with animation frames by default', () => {
    const frames: ((time: number) => void)[] = [];

    vi.stubGlobal('requestAnimationFrame', (step: (time: number) => void) => frames.push(step));

    class Game extends Viewport {
      scene = new Scene();
      camera = new PerspectiveCamera();
    }

    const game = Game.new();
    const element = canvas();
    const gl = { canvas: element, drawingBufferWidth: 1, drawingBufferHeight: 1 } as unknown as WebGLRenderingContext;

    game.attach(element);
    frames.shift()!(0);
    game.attach(gl);

    expect(created).toEqual([
      { canvas: element, antialias: true },
      { canvas: element, context: gl }
    ]);
    expect(frames.length).toBe(2);
  });
});
