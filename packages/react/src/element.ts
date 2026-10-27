import { Component } from '@expressive/mvc';
import { elements } from '@expressive/mvc/jsx-runtime';
import type { Renderable } from '@expressive/mvc/jsx-runtime';
import { useAmbient } from './context';
import { Runtime, useFactory, useWatch } from './runtime';
import { createFrame } from './component';

declare module '@expressive/mvc' {
  interface Component {
    /** @deprecated Only to satisfy host JSX. */
    readonly type: typeof Component;
  }
}

let template: any;

/**
 * Borrow a host element's descriptors so `self` passes as a React element.
 * `props` false keeps the target's own `props` (Component supplies its own);
 * an object installs it as the element's props (collections have none).
 */
export function seam(
  self: object,
  props: object | false,
  type: Function,
  key: unknown
) {
  if (!template) template = Runtime.createElement('template');

  const descriptors = Object.getOwnPropertyDescriptors(template);
  const store = descriptors._store?.value;

  if (props === false) delete (descriptors as any).props;

  if (store)
    descriptors._store.value = Object.create(
      Object.getPrototypeOf(store),
      Object.getOwnPropertyDescriptors(store)
    );

  Object.defineProperties(self, {
    ...descriptors,
    $$typeof: { value: template.$$typeof },
    ...(props ? { props: { value: props } } : undefined),
    key: { value: key },
    type: { value: type }
  });

  return template.$$typeof;
}

/**
 * Every class the core declares renderable - `Component`, `has` lists and
 * pools, `map` collections - gets the one getter. `is` resolves a derived view
 * to its instance; a Component renders through its ownership frame, anything
 * else through `render()`.
 */
elements((Type) => {
  Object.defineProperty(Type.prototype, '$$typeof', {
    get(this: Renderable) {
      const self = this.is;

      return self instanceof Component
        ? seam(self, false, Element.bind(self), self.key)
        : seam(self, {}, Members.bind(self), null);
    }
  });
});

function Element(this: Component){
  const outer = useAmbient();
  const render = useFactory(() => {
    let from = this;
    const context = outer.push(this);
    const Content = () => from.render(from.props);

    return () => {
      from = useWatch(this, () => () => context.pop());

      return createFrame(from, context, Runtime.createElement(Content));
    };
  });

  return render();
}

function Members(this: Renderable) {
  return useWatch(this).render();
}
