import { Component } from '@expressive/mvc';
import { adopter } from '@expressive/mvc/jsx-runtime';
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

/** Prototypes the core declared renderable - `has` lists and pools, `map`s. */
const ADOPTED = new Set<object>();

/** Whether `object` is an instance of an adopted prototype (a derived view is one too). */
function adopted(object: object | null) {
  for (let proto = Object.getPrototypeOf(object); proto; proto = Object.getPrototypeOf(proto))
    if (ADOPTED.has(proto)) return true;

  return false;
}

adopter((prototype, members) => {
  ADOPTED.add(prototype);

  Object.defineProperty(prototype, '$$typeof', {
    configurable: true,
    get() {
      let self = this as object;

      // A view derived from an instance (`Object.create(pool)`) renders the instance.
      for (let proto = Object.getPrototypeOf(self); adopted(proto); proto = Object.getPrototypeOf(self))
        self = proto;

      return seam(self, {}, Members.bind(self, members), null);
    }
  });
});

function Members(this: object, members: (self: unknown) => unknown[]) {
  return members(useWatch(this));
}
