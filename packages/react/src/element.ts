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

/**
 * Brand `Component.prototype` so an activated instance passes as a host element.
 * The `$$typeof` getter is lazy: on first read it rewrites the instance into an
 * element (cloning a real template's descriptors so the shape stays version
 * agnostic) whose `type` is the instance's own borrow host. The template itself
 * is built on first read - not at load - so this may install as a side effect,
 * before the entry populates `Runtime`.
 */
Object.defineProperty(Component.prototype, '$$typeof', {
  get(this: Component) {
    template ||= Runtime.createElement('template');

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
      type: { value: element(this) },
      key: { value: this.key }
    });

    return template.$$typeof;
  }
});

/**
 * Borrow host for a rendered `{instance}`: the instance is externally owned, so
 * each placement gets its own child context (via `useFactory`, one per fiber),
 * subscribes, and on unmount only pops that context - never destroying the
 * instance. Its content render (`instance.render`) is never overwritten, so one
 * instance may back several independent placements.
 */
function element(source: Component) {
  const { createElement: create } = Runtime;

  return function Host() {
    const outer = Context.get();
    const render = useFactory(() => {
      const context = outer.push(source);
      let from = source;
      const Content = () => from.render(from.props);

      return () => {
        from = useHook<Component>((refresh) => {
          if (observer(source) !== null)
            watch(source, refresh);
          return () => context.pop();
        }) || source;

        return frame(from, context, create(Content));
      };
    });

    return render();
  };
}
