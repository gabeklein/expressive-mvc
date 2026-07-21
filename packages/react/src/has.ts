import { has } from '@expressive/mvc';
import { use } from './runtime';
import { seam } from './element';

for (const Collection of [has.List, has.Pool])
  Object.defineProperty(Collection.prototype, '$$typeof', {
    get() {
      const self = source(this) as has.List<unknown>;
      return seam(self, {}, Members.bind(self), null);
    }
  });

function Members(this: has.List<unknown> | has.Pool<unknown>) {
  return [...use(this)];
}

/** Resolve a collection's canonical instance behind any subscriber proxies. */
function source(from: object) {
  let self = from;

  for (
    let proto = Object.getPrototypeOf(self);
    proto instanceof has.List || proto instanceof has.Pool;
    proto = Object.getPrototypeOf(self)
  )
    self = proto;

  return self;
}

export { has };
