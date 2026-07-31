import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

import { Component, Context, get, has, set, State } from '@expressive/mvc';
import { jsx } from './node';
import { render } from './fiber';
import { Group, Mesh } from './object';
import { flushMicrotasks } from '../test.setup';

/** Every object under `target` as a path of constructor names. */
function graph(target: THREE.Object3D, path = ''): string[] {
  return target.children.flatMap((child) => {
    const at = `${path}/${child.constructor.name}`;
    return [at, ...graph(child, at)];
  });
}

describe('hierarchy', () => {
  it('will attach objects to the scene', () => {
    class Ground extends Mesh {}
    class World extends Group {
      render() {
        return <Ground />;
      }
    }

    const scene = new THREE.Scene();

    render(<World />, scene);

    expect(graph(scene)).toEqual(['/Group', '/Group/Mesh']);
  });

  it('will flatten fragments and pass through classes with no object', () => {
    class Rock extends Mesh {}
    class Scenery extends Component {
      render() {
        return (
          <>
            <Rock />
            <Rock />
          </>
        );
      }
    }

    const scene = new THREE.Scene();

    render(
      <Group>
        <Scenery />
      </Group>,
      scene
    );

    expect(graph(scene)).toEqual(['/Group', '/Group/Mesh', '/Group/Mesh']);
  });

  it('will mount a collection of instances', () => {
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

    const scene = new THREE.Scene();

    render(<Field />, scene);

    expect(graph(scene)).toEqual(['/Group', '/Group/Mesh', '/Group/Mesh']);
  });

  it('will not accept a value which is not an element', () => {
    class Bad extends Component {
      render() {
        return 'nope' as never;
      }
    }

    expect(() => render(<Bad />, new THREE.Scene())).toThrowError(
      /cannot contain "nope"/
    );
  });

  it('will throw if element type is not a class', () => {
    const scene = new THREE.Scene();

    expect(() => render(jsx(42, {}), scene)).toThrowError(
      /42 is not a valid element type/
    );
  });

  it('will accept a context to resolve state from', () => {
    class Theme extends State {
      color = 'blue';
    }

    class Themed extends Mesh {
      theme = get(Theme);

      // A class getter cannot override a base-class field under TypeScript
      // (TS2611), so a derived field uses the `set` factory instead.
      material = set((self: Themed) =>
        new THREE.MeshBasicMaterial({ color: self.theme.color })
      );
    }

    const scene = new THREE.Scene();

    render(<Themed />, scene, new Context({ theme: Theme }));

    expect(graph(scene)).toEqual(['/Mesh']);
  });
});

describe('existence', () => {
  it('will add and remove an object as a condition changes', async () => {
    class Lamp extends Mesh {}

    class Room extends Group {
      lit = false;

      render() {
        return this.lit && <Lamp />;
      }
    }

    const scene = new THREE.Scene();
    let room!: Room;

    render(<Room is={(self) => (room = self)} />, scene);

    expect(graph(scene)).toEqual(['/Group']);

    room.lit = true;
    await expect(room).toHaveUpdated();

    expect(graph(scene)).toEqual(['/Group', '/Group/Mesh']);

    room.lit = false;
    await expect(room).toHaveUpdated();

    expect(graph(scene)).toEqual(['/Group']);
  });

  it('will keep an instance across a re-render', async () => {
    class Ball extends Mesh {}

    class Court extends Group {
      count = 0;

      render() {
        return (
          <>
            <Ball key="a" />
            {this.count > 0 && <Ball key="b" />}
          </>
        );
      }
    }

    const scene = new THREE.Scene();
    let court!: Court;

    render(<Court is={(self) => (court = self)} />, scene);

    const [first] = scene.children[0].children;

    court.count = 1;
    await expect(court).toHaveUpdated();

    expect(scene.children[0].children).toHaveLength(2);
    expect(scene.children[0].children[0]).toBe(first);

    const both = [...scene.children[0].children];

    court.count = 2;
    await expect(court).toHaveUpdated();

    expect(scene.children[0].children).toEqual(both);
  });

  it('will destroy an instance it created when removed', async () => {
    const destroyed = vi.fn();

    class Prop extends Mesh {
      protected new() {
        return destroyed;
      }
    }

    class Stage extends Group {
      show = true;

      render() {
        return this.show && <Prop />;
      }
    }

    const scene = new THREE.Scene();
    let stage!: Stage;

    render(<Stage is={(self) => (stage = self)} />, scene);

    stage.show = false;
    await expect(stage).toHaveUpdated();

    expect(destroyed).toHaveBeenCalled();
    expect(graph(scene)).toEqual(['/Group']);
  });

  it('will withhold an object while suspended', async () => {
    class Model extends Mesh {
      asset = set<string>();

      render() {
        void this.asset;
        return null;
      }
    }

    const scene = new THREE.Scene();
    let model!: Model;

    render(<Model is={(self) => (model = self)} />, scene);

    expect(graph(scene)).toEqual([]);

    model.asset = 'ready';
    await expect(model).toHaveUpdated();

    expect(graph(scene)).toEqual(['/Mesh']);
  });

  it('will tear down the whole graph', () => {
    class Rock extends Mesh {}

    const scene = new THREE.Scene();
    const done = render(
      <Group>
        <Rock />
      </Group>,
      scene
    );

    done();

    expect(graph(scene)).toEqual([]);
  });
});

describe('composition', () => {
  it('will resolve state from context instead of props', async () => {
    class Theme extends State {
      color = 'red';
    }

    class Themed extends Mesh {
      theme = get(Theme);

      // A class getter cannot override a base-class field under TypeScript
      // (TS2611), so a derived field uses the `set` factory instead.
      material = set((self: Themed) =>
        new THREE.MeshBasicMaterial({ color: self.theme.color })
      );
    }

    class World extends Group {
      theme = new Theme();

      render() {
        return <Themed />;
      }
    }

    const scene = new THREE.Scene();

    render(<World />, scene);
    await flushMicrotasks();

    const mesh = scene.children[0].children[0] as THREE.Mesh;
    const material = mesh.material as THREE.MeshBasicMaterial;

    expect(material.color.getHexString()).toBe('ff0000');
  });

  it('will compose render through the class hierarchy', () => {
    class Rock extends Mesh {}

    class Shell extends Group {
      render(props: { children?: Component.Node }) {
        return <Group>{props.children}</Group>;
      }
    }

    class Inner extends Shell {
      render() {
        return <Rock />;
      }
    }

    const scene = new THREE.Scene();

    render(<Inner />, scene);

    expect(graph(scene)).toEqual([
      '/Group',
      '/Group/Group',
      '/Group/Group/Mesh'
    ]);
  });

  it('will mount a plain function which returns elements', () => {
    class Rock extends Mesh {}

    const Pile = (props: { of: number }) =>
      Array.from({ length: props.of }, (_, i) => <Rock key={i} />);

    const scene = new THREE.Scene();

    render(
      <Group>
        <Pile of={3} />
      </Group>,
      scene
    );

    expect(graph(scene)).toEqual([
      '/Group',
      '/Group/Mesh',
      '/Group/Mesh',
      '/Group/Mesh'
    ]);
  });

  it('will place an externally owned instance', () => {
    class Rock extends Mesh {}

    const rock = Rock.new();
    const scene = new THREE.Scene();

    const done = render(<Group>{rock}</Group>, scene);

    expect(graph(scene)).toEqual(['/Group', '/Group/Mesh']);

    done();

    expect(rock.get(null)).toBe(false);
  });
});

describe('props', () => {
  it('will apply and update props as fields', async () => {
    class Box extends Mesh {}

    class Holder extends Group {
      y = 1;

      render() {
        return <Box position={[0, this.y, 0]} />;
      }
    }

    const scene = new THREE.Scene();
    let holder!: Holder;

    render(<Holder is={(self) => (holder = self)} />, scene);

    const box = scene.children[0].children[0];

    expect(box.position.y).toBe(1);

    holder.y = 5;
    await expect(holder).toHaveUpdated();
    await flushMicrotasks();

    expect(box.position.y).toBe(5);
  });

  it('will apply transform fields declared by a subclass', () => {
    class Tower extends Group {
      position = [0, 10, 0] as [number, number, number];
      scale = 2;
      visible = false;
    }

    const scene = new THREE.Scene();

    render(<Tower />, scene);

    const tower = scene.children[0];

    expect(tower.position.y).toBe(10);
    expect(tower.scale.x).toBe(2);
    expect(tower.visible).toBe(false);
  });

  it('will accept a scale vector', () => {
    class Slab extends Group {
      scale = [1, 2, 3] as [number, number, number];
    }

    const scene = new THREE.Scene();

    render(<Slab />, scene);

    expect(scene.children[0].scale.z).toBe(3);
  });
});
