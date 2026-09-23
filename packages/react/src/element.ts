import { Component } from '@expressive/mvc';
import { Context } from './context';
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

Object.defineProperty(Component.prototype, '$$typeof', {
  get(this: Component) {
    const self = this.is;
    return seam(self, false, Element.bind(self), self.key);
  }
});

function Element(this: Component){
  const outer = Context.get();
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
