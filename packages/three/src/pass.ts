import { def } from '@expressive/mvc';
import { Euler, Vector3 } from 'three';

import { target } from './target';

type Vec3 = [number, number, number];

/**
 * A reactive passthrough to the three.js object a class represents.
 *
 * There is no shadow copy and no effect syncing one to the other - the object
 * *is* the storage. A read forwards to it; a write forwards and dispatches, so
 * consumers update through the same machinery as any other field. Nothing about
 * a value change reaches a render pipeline.
 *
 * Members three writes by copy rather than assignment (`position`, `rotation`,
 * `scale`) are handled as such, and read back as a plain tuple - a subclass
 * wanting the live `Vector3` for per-frame math uses `this.object`.
 */
function pass<T>(): T {
  return def<T>((key, subject) => ({
    get: () => {
      const value = read(subject, key);
      const vector = vectorOf(value);

      return (vector ? [vector.x, vector.y, vector.z] : value) as T;
    },
    set: (value) => {
      const vector = vectorOf(read(subject, key));

      if (!vector) {
        read(subject, key, value);
        return;
      }

      const [x, y, z] = value as never as Vec3;

      if (vector.x === x && vector.y === y && vector.z === z) throw false;

      vector.set(x, y, z);

      return [x, y, z] as never as T;
    }
  })) as T;
}

/** Read or write a member of the three.js object `subject` represents. */
function read(subject: object, key: string, value?: unknown) {
  const object = target(subject) as never as Record<string, unknown>;

  if (arguments.length > 2) object[key] = value;

  return object[key];
}

function vectorOf(value: unknown) {
  return value instanceof Vector3 || value instanceof Euler ? value : undefined;
}

export { pass, Vec3 };
