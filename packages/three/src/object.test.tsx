import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

import { get, set } from '@expressive/mvc';
import { render } from './fiber';
import { Frame } from './frame';
import { Group, Mesh } from './object';
import { flushMicrotasks } from '../test.setup';

describe('imperative behavior', () => {
  it('will drive an object per frame without a reactive update', async () => {
    class Spinner extends Mesh {
      frame = get(Frame);
      speed = 2;

      protected new() {
        return this.frame.each((delta) => {
          this.object.rotation.y += this.speed * delta;
        });
      }
    }

    class World extends Group {
      frame = new Frame();

      render() {
        return <Spinner />;
      }
    }

    const scene = new THREE.Scene();
    let world!: World;

    render(<World is={(self) => (world = self)} />, scene);

    const spinner = scene.children[0].children[0];

    world.frame.tick(0.5);

    expect(spinner.rotation.y).toBe(1);

    world.frame.tick(0.5);

    expect(spinner.rotation.y).toBe(2);
    await expect(world.frame).not.toHaveUpdated();
  });

  it('will stop driving an object once removed', async () => {
    class Spinner extends Mesh {
      frame = get(Frame);

      protected new() {
        return this.frame.each((delta) => {
          this.object.rotation.y += delta;
        });
      }
    }

    class World extends Group {
      frame = new Frame();
      show = true;

      render() {
        return this.show && <Spinner />;
      }
    }

    const scene = new THREE.Scene();
    let world!: World;

    render(<World is={(self) => (world = self)} />, scene);

    const spinner = scene.children[0].children[0];

    world.frame.tick(1);
    expect(spinner.rotation.y).toBe(1);

    world.show = false;
    await expect(world).toHaveUpdated();

    world.frame.tick(1);
    expect(spinner.rotation.y).toBe(1);
  });

  it('will release resources when destroyed', async () => {
    class Box extends Mesh {
      geometry = new THREE.BoxGeometry();

      protected new() {
        return () => {
          this.geometry.dispose();
        };
      }
    }

    class World extends Group {
      show = true;

      render() {
        return this.show && <Box />;
      }
    }

    const scene = new THREE.Scene();
    let world!: World;

    render(<World is={(self) => (world = self)} />, scene);

    const box = scene.children[0].children[0] as THREE.Mesh;
    const dispose = vi.spyOn(box.geometry, 'dispose');

    world.show = false;
    await expect(world).toHaveUpdated();

    expect(dispose).toHaveBeenCalled();
  });
});

describe('reactive fields', () => {
  it('will swap geometry in place', async () => {
    class Shape extends Mesh {
      round = false;

      geometry = set((self: Shape) =>
        self.round ? new THREE.SphereGeometry() : new THREE.BoxGeometry()
      );
    }

    const scene = new THREE.Scene();
    let shape!: Shape;

    render(<Shape is={(self) => (shape = self)} />, scene);

    // A computed getter first read during activation resolves on the next
    // microtask - its initial value does not reach the object synchronously.
    await flushMicrotasks();

    const mesh = scene.children[0] as THREE.Mesh;

    expect(mesh.geometry.type).toBe('BoxGeometry');

    shape.round = true;
    await expect(shape).toHaveUpdated();

    expect(mesh.geometry.type).toBe('SphereGeometry');
    expect(mesh).toBe(scene.children[0]);
  });

  it('will name objects for inspection', () => {
    class Rock extends Mesh {}

    const scene = new THREE.Scene();

    render(<Rock />, scene);

    expect(scene.children[0].name).toMatch(/^Rock-/);
  });
});
