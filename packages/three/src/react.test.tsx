import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

import { get, has, set } from '@expressive/mvc';

import { Frame, Group, Mesh, Scene } from './react';

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

    expect(graph(scene.object)).toEqual([
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

    expect(graph(scene.object)).toEqual(['/Mesh', '/Mesh']);
  });

  it('will resolve state from context rather than props', async () => {
    class Theme extends Mesh {
      color = 'red';
    }

    class Themed extends Mesh {
      theme = get(Theme);

      material = set(
        (self: Themed) => new THREE.MeshBasicMaterial({ color: self.theme.color })
      );
    }

    let themed!: Themed;

    render(
      <Scene>
        <Theme>
          <Themed is={(self) => (themed = self)} />
        </Theme>
      </Scene>
    );

    await act(async () => {});

    const material = themed.object.material as THREE.MeshBasicMaterial;

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

    expect(graph(scene.object)).toEqual(['/Group']);

    await act(async () => {
      room.lit = true;
    });

    expect(graph(scene.object)).toEqual(['/Group', '/Group/Mesh']);

    await act(async () => {
      room.lit = false;
    });

    expect(graph(scene.object)).toEqual(['/Group']);
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

    const { object } = scene;

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

    expect(spinner.object.rotation.y).toBe(2);
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

    expect(graph(scene.object)).toEqual([
      '/Group',
      '/Group/Mesh',
      '/Group/Mesh'
    ]);
  });
});
