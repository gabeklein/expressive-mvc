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
      this.rotation.y += this.speed * delta; // in place - no dispatch
    });
  }
}

class Arena extends Scene {
  ground = new Mesh();
  spinner = new Spinner({ position: new THREE.Vector3(0, 1, 0) });
}

class Eye extends PerspectiveCamera {
  position = new THREE.Vector3(0, 2, 6);
}

class Game extends Viewport {
  scene = new Arena();
  camera = new Eye();
}

const game = Game.new();
const arena = game.scene;

// any host: <canvas ref={game.canvas} /> - or game.attach(canvas | gl)

arena.spinner.position = new THREE.Vector3(0, 2, 0); // copied into the object, dispatched
arena.spinner.position.y += 1; // in place, silent - `set('position')` to announce
arena.spinner.boost(1);
```

- **Nodes** - `Object3D`, `Group`, `Scene`, `Mesh`, `PerspectiveCamera`,
  `OrthographicCamera`, and `AmbientLight`, `HemisphereLight`,
  `DirectionalLight`, `PointLight`, `SpotLight` (all `Light`). Each represents one three.js
  object, made once by `create()` and held as protected `_object`.
- **Members** - `visible`, plus `geometry` and `material` on `Mesh`, are
  reactive fields stored on the three.js object. Cameras and lights add their
  own (`fov`, `zoom`, `intensity`, ...); projection updates as they change. `position`, `rotation` and
  `scale` read as the object's live vectors: assign one to place (copied in,
  dispatched if changed), mutate in place to animate (silent). Light colors work
  the same way. A subclass sets
  defaults as plain fields; constructor arguments override them.
- **Placement** - unset, a node draws under the nearest `Object3D` owning it,
  through a field or a `has()` pool, past owners which are not nodes. A `get()`
  reference or an already-active instance does not attach. Assign `parent` to
  draw elsewhere (`null` for nowhere, or `parent = get(World)`); `children` lists
  what draws under a node. Placement never changes lifetime - destroying a node
  detaches it, destroying its parent returns it to its owner.
- **`Viewport`** - the one host-facing root. Owns the renderer and a `Frame`; a
  subclass supplies `scene` and `camera`. Draws every frame while attached to a
  canvas or WebGL context, sizing renderer and camera to it. `draw()` is
  protected - override to wrap it.
- **`Frame`** - per-frame callbacks via `each()`, mutating vectors in place. `loop()`
  drives one from `requestAnimationFrame`.
