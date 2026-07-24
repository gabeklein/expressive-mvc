import { map } from '@expressive/mvc';
import { use } from './runtime';
import { seam } from './element';

Object.defineProperty(map.Managed.prototype, '$$typeof', {
  get() {
    const self = source(this) as map.Managed<unknown, unknown>;
    return seam(self, {}, Values.bind(self), null);
  }
});

function Values(this: map.Managed<unknown, unknown>) {
  return [...use(this).values()];
}

/** Resolve a map's canonical instance behind any subscriber proxies. */
function source(from: object) {
  let self = from;

  for (
    let proto = Object.getPrototypeOf(self);
    proto instanceof map.Managed;
    proto = Object.getPrototypeOf(self)
  )
    self = proto;

  return self;
}

export { map };
