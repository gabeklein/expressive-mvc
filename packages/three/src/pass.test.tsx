import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

import { State } from '@expressive/mvc';

import { Mesh, Scene } from './react';
import { pass } from './pass';
import { target } from './target';
import { flushMicrotasks } from '../test.setup';

describe('read', () => {
  it('will read straight from the three.js object', () => {
    const mesh = Mesh.new();
    const object = target(mesh) as THREE.Mesh;

    object.visible = false;
    object.position.set(1, 2, 3);

    expect(mesh.visible).toBe(false);
    expect(mesh.position).toEqual([1, 2, 3]);
  });

  it('will hold no shadow copy of a value', () => {
    const mesh = Mesh.new();
    const object = target(mesh) as THREE.Mesh;

    expect(mesh.geometry).toBe(object.geometry);
    expect(mesh.material).toBe(object.material);
  });
});

describe('write', () => {
  it('will assign through to the object', () => {
    const mesh = Mesh.new();
    const object = target(mesh) as THREE.Mesh;
    const geometry = new THREE.SphereGeometry();

    mesh.visible = false;
    mesh.geometry = geometry;

    expect(object.visible).toBe(false);
    expect(object.geometry).toBe(geometry);
  });

  it('will copy into a vector rather than replace it', () => {
    const mesh = Mesh.new();
    const { position } = target(mesh);

    mesh.position = [4, 5, 6];

    expect(target(mesh).position).toBe(position);
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
});

describe('methods', () => {
  it('will dispatch after mutating imperatively', async () => {
    const mesh = Mesh.new();

    mesh.lookAt(0, 0, 1);

    await expect(mesh).toHaveUpdated('rotation');
    expect(mesh.rotation[1]).toBeCloseTo(0);
  });
});

describe('contract', () => {
  it('will throw if used outside a scene object', () => {
    class Rogue extends State {
      value = pass<number>();
    }

    // Lazy - the passthrough resolves on access, not at activation.
    expect(() => Rogue.new().value).toThrowError(
      /does not represent a three.js object/
    );
  });

  it('will not apply a field initializer which shadows a passthrough', () => {
    const geometry = new THREE.SphereGeometry();

    // A subclass field initializer replaces the instruction before it resolves,
    // leaving ordinary state which no longer reaches the object. Defaults for a
    // passthrough belong in `create`, or as an assignment in `new`.
    class Shadowed extends Mesh {
      geometry = geometry;
    }

    const shadowed = Shadowed.new();

    expect(shadowed.geometry).toBe(geometry);
    expect((target(shadowed) as THREE.Mesh).geometry).not.toBe(geometry);
  });

  it('will not replace the object when a props object is reused', () => {
    const props = {};
    const first = new Mesh(props);
    const object = target(first);

    // Component dedupes construction against a pending props object; the
    // second call returns the first instance rather than a new one.
    const second = new Mesh(props);

    expect(second).toBe(first);
    expect(target(second)).toBe(object);
  });

  it('will apply a default assigned in new', () => {
    const geometry = new THREE.SphereGeometry();

    class Ball extends Mesh {
      protected new() {
        this.geometry = geometry;
      }
    }

    const ball = Ball.new();

    expect((target(ball) as THREE.Mesh).geometry).toBe(geometry);
  });
});

describe('render pipeline', () => {
  it('will not re-render React when a value changes', async () => {
    const rendered = vi.fn();

    class Box extends Mesh {
      render() {
        rendered();
        return null;
      }
    }

    let box!: Box;

    render(
      <Scene>
        <Box is={(self) => (box = self)} />
      </Scene>
    );

    const before = rendered.mock.calls.length;

    box.position = [0, 3, 0];
    box.visible = false;

    await flushMicrotasks();

    expect(target(box).position.y).toBe(3);
    expect(target(box).visible).toBe(false);
    expect(rendered.mock.calls.length).toBe(before);
  });
});
