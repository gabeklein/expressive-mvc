import { map } from '@expressive/mvc';
import { useWatch } from './runtime';
import { seam } from './element';

Object.defineProperty(map.Managed.prototype, '$$typeof', {
  get() {
    let self = this as map.Managed<unknown, unknown>;

    for (
      let proto = Object.getPrototypeOf(self);
      proto instanceof map.Managed;
      proto = Object.getPrototypeOf(self)
    )
      self = proto;

    return seam(self, {}, Values.bind(self), null);
  }
});

function Values(this: map.Managed<unknown, unknown>) {
  const self = useWatch(this);

  return [...self.values()];
}

export { map };
