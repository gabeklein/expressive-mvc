import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { set } from '@expressive/mvc';

import { Mesh, objectOf, Vec3 } from './object';
import { flushMicrotasks } from '../test.setup';

const meshOf = (self: object) => objectOf(self) as THREE.Mesh;

describe('read', () => {
  it('will read straight from the three.js object', () => {
    const mesh = Mesh.new();

    meshOf(mesh).visible = false;
    meshOf(mesh).position.set(1, 2, 3);

    expect(mesh.visible).toBe(false);
    expect(mesh.position).toEqual([1, 2, 3]);
  });

  it('will hold no shadow copy of a value', () => {
    const mesh = Mesh.new();

    expect(mesh.geometry).toBe(meshOf(mesh).geometry);
    expect(mesh.material).toBe(meshOf(mesh).material);
  });

  it('will name the object for inspection', () => {
    class Rock extends Mesh {}

    expect(objectOf(Rock.new()).name).toMatch(/^Rock-/);
  });
});

describe('write', () => {
  it('will assign through to the object', () => {
    const mesh = Mesh.new();
    const geometry = new THREE.SphereGeometry();

    mesh.visible = false;
    mesh.geometry = geometry;

    expect(meshOf(mesh).visible).toBe(false);
    expect(meshOf(mesh).geometry).toBe(geometry);
  });

  it('will copy into a vector rather than replace it', () => {
    const mesh = Mesh.new();
    const { position } = meshOf(mesh);

    mesh.position = [4, 5, 6];

    expect(meshOf(mesh).position).toBe(position);
    expect(position.toArray()).toEqual([4, 5, 6]);
  });

  it('will dispatch an update to consumers', async () => {
    const mesh = Mesh.new();

    mesh.position = [1, 0, 0];

    await expect(mesh).toHaveUpdated('position');
  });

  it('will not dispatch when a vector is unchanged', async () => {
    const mesh = Mesh.new();

    mesh.position = [1, 0, 0];
    await expect(mesh).toHaveUpdated('position');

    mesh.position = [1, 0, 0];
    await expect(mesh).not.toHaveUpdated();
  });

  it('will drive a computed value', async () => {
    class Box extends Mesh {
      get height() {
        return this.scale[1];
      }
    }

    const box = Box.new();

    await flushMicrotasks();
    expect(box.height).toBe(1);

    box.scale = [1, 4, 1];
    await expect(box).toHaveUpdated('scale');

    expect(box.height).toBe(4);
  });

  it('will dispatch after mutating imperatively', async () => {
    const mesh = Mesh.new();

    mesh.lookAt(0, 0, 1);

    await expect(mesh).toHaveUpdated('rotation');
    expect(mesh.rotation[1]).toBeCloseTo(0);
  });
});

describe('subclass defaults', () => {
  it('will route a field default to the object', () => {
    const geometry = new THREE.SphereGeometry();

    class Ball extends Mesh {
      geometry = geometry;
    }

    const ball = Ball.new();

    expect(meshOf(ball).geometry).toBe(geometry);
    expect(ball.geometry).toBe(geometry);
  });

  it('will copy a vector default into the object', () => {
    class Raised extends Mesh {
      position: Vec3 = [0, 2, 0];
    }

    expect(meshOf(Raised.new()).position.y).toBe(2);
  });

  it('will accept a default equal to the current value', () => {
    class Grounded extends Mesh {
      position: Vec3 = [0, 0, 0];
    }

    expect(Grounded.new().position).toEqual([0, 0, 0]);
  });

  it('will let a constructor argument override the default', () => {
    class Raised extends Mesh {
      position: Vec3 = [0, 2, 0];
    }

    expect(Raised.new({ position: [0, 5, 0] }).position).toEqual([0, 5, 0]);
  });

  it('will throw if a subclass derives a member with an instruction', () => {
    class Derived extends Mesh {
      geometry = set((self: Derived) => new THREE.BoxGeometry(self.scale[0]));
    }

    expect(() => Derived.new()).toThrowError(
      /geometry is stored on its three.js object/
    );
  });
});
