import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

import { get, has, set, State } from '@expressive/mvc';

import { Frame, Group, Mesh, Scene } from './react';
import { target } from './target';

/** Every object under `target` as a path of constructor names. */
function graph(target: THREE.Object3D, path = ''): string[] {
  return target.children.flatMap((child) => {
    const at = `${path}/${child.constructor.name}`;
    return [at, ...graph(child, at)];
  });
}

describe('composition', () => {
  it('will build a graph from plain React JSX', () => {
    class Ground extends Mesh {}
    class Rock extends Mesh {}

    let scene!: Scene;

    render(
      <Scene is={(self) => (scene = self)}>
        <Ground />
        <Group>
          <Rock />
        </Group>
      </Scene>
    );

    expect(graph(target(scene))).toEqual([
      '/Mesh',
      '/Group',
      '/Group/Mesh'
    ]);
  });

  it('will attach through a component with no object', () => {
    class Rock extends Mesh {}

    const Scenery = () => (
      <>
        <Rock />
        <Rock />
      </>
    );

    let scene!: Scene;

    render(
      <Scene is={(self) => (scene = self)}>
        <Scenery />
      </Scene>
    );

    expect(graph(target(scene))).toEqual(['/Mesh', '/Mesh']);
  });

  it('will resolve state from context rather than props', async () => {
    class Theme extends State {
      color = 'red';
    }

    // A passthrough cannot be redeclared as a computed - the object is the
    // storage, so a derived value is assigned by an effect instead.
    class Themed extends Mesh {
      theme = get(Theme);

      protected new() {
        return this.get(({ theme }) => {
          this.material = new THREE.MeshBasicMaterial({ color: theme.color });
        });
      }
    }

    class World extends Group {
      theme = new Theme();
    }

    let themed!: Themed;

    render(
      <Scene>
        <World>
          <Themed is={(self) => (themed = self)} />
        </World>
      </Scene>
    );

    await act(async () => {});

    const material = (target(themed) as THREE.Mesh).material as THREE.MeshBasicMaterial;

    expect(material.color.getHexString()).toBe('ff0000');
  });
});

describe('existence', () => {
  it('will add and remove an object as React re-renders', async () => {
    class Lamp extends Mesh {}

    class Room extends Group {
      lit = false;

      render() {
        return this.lit && <Lamp />;
      }
    }

    let room!: Room;
    let scene!: Scene;

    render(
      <Scene is={(self) => (scene = self)}>
        <Room is={(self) => (room = self)} />
      </Scene>
    );

    expect(graph(target(scene))).toEqual(['/Group']);

    await act(async () => {
      room.lit = true;
    });

    expect(graph(target(scene))).toEqual(['/Group', '/Group/Mesh']);

    await act(async () => {
      room.lit = false;
    });

    expect(graph(target(scene))).toEqual(['/Group']);
  });

  it('will attach a node even while its render is suspended', async () => {
    class Model extends Mesh {
      asset = set<string>();

      render() {
        void this.asset;
        return null;
      }
    }

    let scene!: Scene;
    let model!: Model;

    render(
      <Scene is={(self) => (scene = self)}>
        <Model is={(self) => (model = self)} />
      </Scene>
    );

    // Attachment is at activation, so React showing a fallback does not keep a
    // node out of the graph. Gate an asset-dependent node at the call site.
    expect(graph(target(scene))).toEqual(['/Mesh']);

    await act(async () => {
      model.asset = 'ready';
    });

    expect(graph(target(scene))).toEqual(['/Mesh']);
  });

  it('will detach and dispose on unmount', () => {
    const dispose = vi.fn();

    class Box extends Mesh {
      geometry = new THREE.BoxGeometry();

      protected new() {
        return () => {
          dispose();
          this.geometry.dispose();
        };
      }
    }

    let scene!: Scene;

    const view = render(
      <Scene is={(self) => (scene = self)}>
        <Box />
      </Scene>
    );

    const object = target(scene);

    expect(graph(object)).toEqual(['/Mesh']);

    view.unmount();

    expect(graph(object)).toEqual([]);
    expect(dispose).toHaveBeenCalled();
  });
});

describe('imperative behavior', () => {
  it('will drive an object per frame with no React render', () => {
    const rendered = vi.fn();

    class Spinner extends Mesh {
      frame = get(Frame);
      speed = 2;

      protected new() {
        return this.frame.each((delta) => {
          this.object.rotation.y += this.speed * delta;
        });
      }

      render() {
        rendered();
        return null;
      }
    }

    class World extends Group {
      frame = new Frame();
    }

    let world!: World;
    let spinner!: Spinner;

    render(
      <Scene>
        <World is={(self) => (world = self)}>
          <Spinner is={(self) => (spinner = self)} />
        </World>
      </Scene>
    );

    const before = rendered.mock.calls.length;

    world.frame.tick(0.5);
    world.frame.tick(0.5);

    expect(target(spinner).rotation.y).toBe(2);
    expect(rendered.mock.calls.length).toBe(before);
  });
});

describe('collections', () => {
  it('will attach members of an owned collection', () => {
    class Rock extends Mesh {}

    class Field extends Group {
      rocks = has(Rock);

      protected new() {
        this.rocks.add();
        this.rocks.add();
      }

      render() {
        return <>{this.rocks}</>;
      }
    }

    let scene!: Scene;

    render(
      <Scene is={(self) => (scene = self)}>
        <Field />
      </Scene>
    );

    expect(graph(target(scene))).toEqual([
      '/Group',
      '/Group/Mesh',
      '/Group/Mesh'
    ]);
  });
});
