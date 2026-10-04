import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

import { get, has, set, State } from '@expressive/mvc';

import { Frame } from './frame';
import { Group, Mesh, objectOf, Scene, Vec3 } from './object';
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

/** Every object under `target` as a path of constructor names. */
function graph(target: THREE.Object3D, path = ''): string[] {
  return target.children.flatMap((child) => {
    const at = `${path}/${child.constructor.name}`;
    return [at, ...graph(child, at)];
  });
}

describe('hierarchy', () => {
  it('will mirror ownership', () => {
    class Rock extends Mesh {}

    class Pile extends Group {
      a = new Rock();
      b = new Rock();
    }

    class World extends Scene {
      ground = new Mesh();
      pile = new Pile();
    }

    expect(graph(objectOf(World.new()))).toEqual([
      '/Mesh',
      '/Group',
      '/Group/Mesh',
      '/Group/Mesh'
    ]);
  });

  it('will attach through owners which are not scene objects', () => {
    class Level extends State {
      rock = new Mesh();
    }

    class World extends Scene {
      level = new Level();
    }

    expect(graph(objectOf(World.new()))).toEqual(['/Mesh']);
  });

  it('will attach members of an owned collection', () => {
    class Field extends Scene {
      rocks = has(Mesh);
    }

    const field = Field.new();

    field.rocks.add();
    field.rocks.add();

    expect(graph(objectOf(field))).toEqual(['/Mesh', '/Mesh']);
  });

  it('will not attach a node it only references', () => {
    class Player extends Mesh {}

    class Follower extends Mesh {
      player = get(Player);
    }

    class World extends Scene {
      player = new Player();
      follower = new Follower();
    }

    const world = World.new();

    expect(world.follower.player).toBe(world.player);
    expect(graph(objectOf(world))).toEqual(['/Mesh', '/Mesh']);
  });

  it('will not attach an instance it did not create', () => {
    class World extends Scene {
      guest?: Mesh = undefined;
    }

    const world = World.new();

    world.guest = Mesh.new();

    expect(graph(objectOf(world))).toEqual([]);
  });

  it('will resolve state from context rather than props', async () => {
    class Theme extends State {
      color = 'red';
    }

    class Themed extends Mesh {
      theme = get(Theme);

      protected new() {
        return this.get(({ theme }) => {
          this.material = new THREE.MeshBasicMaterial({ color: theme.color });
        });
      }
    }

    class World extends Scene {
      theme = new Theme();
      themed = new Themed();
    }

    const world = World.new();

    await flushMicrotasks();

    const material = meshOf(world.themed).material as THREE.MeshBasicMaterial;

    expect(material.color.getHexString()).toBe('ff0000');
  });
});

describe('existence', () => {
  it('will add and remove a node as its field changes', async () => {
    class Room extends Scene {
      lamp?: Mesh = undefined;
    }

    const room = Room.new();

    expect(graph(objectOf(room))).toEqual([]);

    room.lamp = new Mesh();

    expect(graph(objectOf(room))).toEqual(['/Mesh']);

    room.lamp = undefined;
    await flushMicrotasks();

    expect(graph(objectOf(room))).toEqual([]);
  });

  it('will remove a member deleted from its collection', () => {
    class Field extends Scene {
      rocks = has(Mesh);
    }

    const field = Field.new();
    const rock = field.rocks.add();

    field.rocks.add();
    field.rocks.delete(rock);

    expect(graph(objectOf(field))).toEqual(['/Mesh']);
  });

  it('will detach and dispose when destroyed', () => {
    const dispose = vi.fn();

    class Box extends Mesh {
      geometry = new THREE.BoxGeometry();

      protected new() {
        return dispose;
      }
    }

    class World extends Scene {
      box = new Box();
    }

    const world = World.new();
    const object = objectOf(world);

    expect(graph(object)).toEqual(['/Mesh']);

    world.set(null);

    expect(graph(object)).toEqual([]);
    expect(dispose).toHaveBeenCalled();
  });
});

describe('imperative behavior', () => {
  it('will drive an object per frame with no update dispatched', async () => {
    class Spinner extends Mesh {
      frame = get(Frame);
      speed = 2;

      protected new() {
        return this.frame.each((delta) => {
          this._object.rotation.y += this.speed * delta;
        });
      }
    }

    class World extends Scene {
      frame = new Frame();
      spinner = new Spinner();
    }

    const world = World.new();

    await flushMicrotasks();

    world.frame.tick(0.5);
    world.frame.tick(0.5);

    expect(meshOf(world.spinner).rotation.y).toBe(2);
    await expect(world.spinner).not.toHaveUpdated();
  });
});
