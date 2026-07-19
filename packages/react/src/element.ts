import { Component } from '@expressive/mvc';
import { watch, observer } from '@expressive/mvc/observable';
import { Context } from './context';
import { Runtime, useFactory, useHook } from './runtime';
import { frame } from './component';

declare module '@expressive/mvc' {
  interface Component {
    /** @deprecated Only to satisfy host JSX. */
    readonly type: typeof Component;
  }
}

let template: any;

Object.defineProperty(Component.prototype, '$$typeof', {
  get(this: Component) {
    if(!template) template = Runtime.createElement('template');

    const descriptors = Object.getOwnPropertyDescriptors(template);
    const store = descriptors._store?.value;

    delete descriptors.props;

    if (store)
      descriptors._store.value = Object.create(
        Object.getPrototypeOf(store),
        Object.getOwnPropertyDescriptors(store)
      );

    Object.defineProperties(this, {
      ...descriptors,
      $$typeof: { value: template.$$typeof },
      key: { value: this.key },
      type: { value: Element.bind(this) }
    });

    return template.$$typeof;
  }
});

function Element(this: Component){
  const outer = Context.get();
  const render = useFactory(() => {
    let from = this;
    const context = outer.push(this);
    const Content = () => from.render(from.props);

    return () => {
      from = useHook<Component>((refresh) => {
        if (observer(this) !== null) watch(this, refresh);
        return () => context.pop();
      }) || this;

      return frame(from, context, Runtime.createElement(Content));
    };
  });

  return render();
}