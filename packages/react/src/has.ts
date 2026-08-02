import { has } from '@expressive/mvc';
import { useWatch } from './runtime';
import { seam } from './element';

for (const Collection of [has.List, has.Pool])
  Object.defineProperty(Collection.prototype, '$$typeof', {
    get() {
      let self = this as has.List<unknown> | has.Pool<unknown>;

      for (
        let proto = Object.getPrototypeOf(self);
        proto instanceof has.List || proto instanceof has.Pool;
        proto = Object.getPrototypeOf(self)
      )
        self = proto;

      return seam(self, {}, Members.bind(self), null);
    }
  });

function Members(this: has.List<unknown> | has.Pool<unknown>) {
  const self = useWatch(this);

  return [...self];
}

export { has };
