import { map } from '@expressive/mvc';
import { watch } from '@expressive/mvc/observable';
import { useHook } from './runtime';
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
  const self = useHook<map.Managed<unknown, unknown>>((refresh) => {
    const release = watch(this, refresh);
    return () => release;
  });

  return [...self.values()];
}

export { map };
