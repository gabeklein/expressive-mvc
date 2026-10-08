import * as THREE from 'three';
import { Mesh, PerspectiveCamera, Scene, Viewport } from '../../packages/three/src/index';

const lines: string[] = [];

function check(name: string, pass: boolean, detail: string) {
  lines.push(`${pass ? 'PASS' : 'FAIL'} ${name} - ${detail}`);
}

class Box extends Mesh {
  geometry = new THREE.BoxGeometry(2, 2, 2);
  material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
}

class Arena extends Scene {
  box = new Box();
}

class Eye extends PerspectiveCamera {
  position = new THREE.Vector3(0, 0, 5);
}

type Pixel = [number, number, number];

const red = (p: Pixel) => p[0] > 200 && p[1] < 40 && p[2] < 40;
const dark = (p: Pixel) => p[0] < 40 && p[1] < 40 && p[2] < 40;

class Probe extends Viewport {
  scene = new Arena();
  camera = new Eye();

  protected schedule(step: (time: number) => void) {
    setTimeout(() => step(performance.now()));
  }

  _frames: { center: Pixel; corner: Pixel }[] = [];
  _steps: (() => void)[] = [];
  _done!: () => void;

  protected draw() {
    super.draw();

    const gl = (this._renderer as unknown as THREE.WebGLRenderer).getContext();
    const read = (x: number, y: number): Pixel => {
      const pixel = new Uint8Array(4);
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return [pixel[0], pixel[1], pixel[2]];
    };

    this._frames.push({ center: read(gl.drawingBufferWidth >> 1, gl.drawingBufferHeight >> 1), corner: read(1, 1) });

    const next = this._steps.shift();
    if (next) next();
    else this._done();
  }
}

const element = document.createElement('canvas');
element.style.cssText = 'width: 64px; height: 64px; display: block';
document.body.append(element);

const probe = Probe.new();
const { box } = probe.scene;

probe._steps.push(
  () => (box.position = new THREE.Vector3(10, 0, 0)),
  () => (box.position.x = 0),
  () => (box.parent = null),
  () => (box.parent = undefined)
);

await new Promise<void>((resolve) => {
  probe._done = resolve;
  probe.attach(element);
});

probe.set(null);

const [first, moved, mutated, unplaced, restored] = probe._frames;
const show = (p: Pixel) => `rgb(${p.join(', ')})`;

check('draws the scene through its camera', red(first.center), `center ${show(first.center)}`);
check('clears around it', dark(first.corner), `corner ${show(first.corner)}`);
check('assignment moves the box', dark(moved.center), `center ${show(moved.center)}`);
check('in-place mutation still draws', red(mutated.center), `center ${show(mutated.center)}`);
check('parent = null stops drawing it', dark(unplaced.center), `center ${show(unplaced.center)}`);
check('unset parent draws it under its owner again', red(restored.center), `center ${show(restored.center)}`);

const pre = document.createElement('pre');
pre.id = 'out';
pre.textContent = lines.join('\n');
document.body.append(pre);
