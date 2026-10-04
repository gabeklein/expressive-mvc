# @expressive/three

A three.js scene graph built from Expressive MVC `State` classes. Unreleased -
scope, decisions and status live in [FEATURE.md](../../FEATURE.md).

```ts
class Spinner extends Mesh {
  frame = get(Frame);
  speed = 2;

  geometry = new THREE.BoxGeometry();
  material = new THREE.MeshStandardMaterial({ color: 'tomato' });

  boost(by: number) {
    this.speed += by;
  }

  protected new() {
    return this.frame.each((delta) => {
      this._object.rotation.y += this.speed * delta;
    });
  }
}

class Arena extends Scene {
  frame = new Frame();
  ground = new Mesh();
  spinner = new Spinner({ position: [0, 1, 0] });
}

const arena = Arena.new();

arena.spinner.position = [0, 2, 0]; // written to the three.js object, dispatched
arena.spinner.boost(1);
```

- **Nodes** - `Object3D`, `Group`, `Scene`, `Mesh`. Each represents one three.js
  object, made once by `create()` and held as protected `_object`.
- **Members** - `visible`, `position`, `rotation`, `scale`, plus `geometry` and
  `material` on `Mesh`, are reactive fields stored on the three.js object.
  Vectors read and write as `[x, y, z]`. A subclass sets defaults as plain
  fields; constructor arguments override them.
- **Hierarchy** - a node attaches under the nearest `Object3D` owning it, through
  a field or a `has()` pool, past owners which are not nodes. A `get()` reference
  or an already-active instance does not attach. Destroying a node detaches it.
- **`Frame`** - per-frame callbacks via `each()`, dispatching nothing. `loop()`
  drives one from `requestAnimationFrame`.
