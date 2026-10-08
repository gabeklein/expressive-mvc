import { ref, State } from '@expressive/mvc';
import * as THREE from 'three';

import { fit } from './camera';
import { Frame, loop } from './frame';
import { Object3D, objectOf, Scene, verify } from './object';

declare namespace Viewport {
  /** A canvas, or a WebGL context a host made - React Native's `GLView` gives one. */
  type Surface = HTMLCanvasElement | WebGLRenderingContext | WebGL2RenderingContext;

  interface Renderer {
    setSize(width: number, height: number, updateStyle?: boolean): void;
    setPixelRatio(ratio: number): void;
    render(scene: THREE.Object3D, camera: THREE.Camera): void;
    dispose(): void;
  }
}

const DETACH = new WeakMap<Viewport, () => void>();

/** The host-facing root - draws `scene` through `camera` every frame once given a surface. */
class Viewport extends State {
  /** Clock for everything under this viewport - nodes read it with `get(Frame)`. */
  frame = new Frame();

  declare scene: Scene;
  declare camera: Object3D<THREE.Camera>;

  /** For a host's `<canvas ref>` - attached while the element is mounted. */
  canvas = ref<HTMLCanvasElement>((element) => this.attach(element));

  /** The renderer while attached - for a `draw` override. */
  protected _renderer?: Viewport.Renderer;

  /** Draw into `surface` until the returned function is called. */
  attach(surface: Viewport.Surface) {
    if (!this.scene || !this.camera)
      throw new Error(`${this} needs a scene and a camera to draw.`);

    DETACH.get(this)?.();

    const renderer = this.createRenderer(surface);
    const resize = (width: number, height: number) => {
      renderer.setPixelRatio(globalThis.devicePixelRatio || 1);
      renderer.setSize(width, height, false);

      fit(this.camera, width, height);
    };

    let observer: ResizeObserver | undefined;

    if ('getContext' in surface) {
      resize(surface.clientWidth, surface.clientHeight);

      if (typeof ResizeObserver == 'function') {
        observer = new ResizeObserver(() => resize(surface.clientWidth, surface.clientHeight));
        observer.observe(surface);
      }
    } else resize(surface.drawingBufferWidth, surface.drawingBufferHeight);

    this._renderer = renderer;

    const stop = loop(
      {
        tick: (delta) => {
          this.frame.tick(delta);
          this.draw();
        }
      },
      (step) => this.schedule(step)
    );

    const detach = () => {
      if (DETACH.get(this) !== detach) return;

      DETACH.delete(this);
      stop();
      observer?.disconnect();
      renderer.dispose();
      this._renderer = undefined;
    };

    DETACH.set(this, detach);

    return detach;
  }

  /** One frame, after the clock ticks - override to wrap it, e.g. for post-processing. */
  protected draw() {
    verify();
    this._renderer!.render(objectOf(this.scene), objectOf(this.camera) as THREE.Camera);
  }

  protected createRenderer(surface: Viewport.Surface): Viewport.Renderer {
    return 'getContext' in surface
      ? new THREE.WebGLRenderer({ canvas: surface, antialias: true })
      : new THREE.WebGLRenderer({ canvas: surface.canvas as HTMLCanvasElement, context: surface });
  }

  protected schedule(step: (time: number) => void) {
    requestAnimationFrame(step);
  }
}

Viewport.on({
  ready(self) {
    return () => DETACH.get(self)?.();
  }
});

export { Viewport };
