import { watch, observer, Component } from '@expressive/mvc';
import React, { createElement, Suspense } from 'react';
import { Context, Layers } from './context';
import { useHook, useReady } from './runtime';
import { intercept, defineSubcomponent } from './seam';

const proto = Component.prototype;
const SEEN = new WeakSet<object>([proto]);

declare module '@expressive/mvc' {
  interface Component {
    /** @deprecated Only to satisfy React JSX. Use `this.get(State)` instead. */
    readonly context: Context;
    /** @deprecated Only to satisfy React JSX. Use `this.get()` instead. */
    readonly state: State.Values<this>;
    /** @deprecated Only to satisfy React JSX. Use `this.set({})` instead. */
    setState: (state: any, callback?: () => void) => void;
    /** @deprecated Only to satisfy React JSX. Use `this.set(key)` instead. */
    forceUpdate: (callback?: () => void) => void;
  }
}

Component.on(subcomponents);
Object.defineProperty(Component, 'contextType', { configurable: true, get: Layers });

intercept(proto, [
  'updater',
  'refs',
  '_reactInternals',
  '_reactInternalInstance'
]);

Object.defineProperties(proto, {
  isReactComponent: {
    get: () => true
  },
  state: {
    set() { },
    get: proto.get
  },
  context: {
    set(this: Component, context: Context) {
      context = context.push();
      context.set(this, () => () => this.set(null));

      const props = Object.getOwnPropertyDescriptor(this, 'props')!;

      Object.defineProperties(this, {
        props: {
          ...props,
          set: (next: {}) => {
            if (this.get(null))
              Object.defineProperty(this, 'props', {
                value: next,
                writable: true,
                configurable: true
              });
            else
              props.set!.call(this, next);
          }
        },
        context: {
          get: () => context,
          set() { }
        },
        render: {
          value: component(this, context)
        }
      });
    }
  }
});

/** In-flight render attempts by tree position, per ambient context.
 *  When one commits, older uncommitted attempts at its slot are provably dead. */
const SLOTS = new WeakMap<Context, Map<string, Set<Entry>>>();

interface Entry {
  committed?: boolean;
  context: Context;
  commit: () => void;
  remove: () => void;
};

/** Register a render attempt; superseded or unmounted attempts are killed. */
function register(on: Component, context: Context) {
  let slots = SLOTS.get(context.parent!);
  if (!slots) SLOTS.set(context.parent!, (slots = new Map()));

  // key/index path to root: stable across render attempts of this element
  let slot = '';
  for (let f = (on as any)._reactInternals; f; f = f.return)
    slot += (f.key ?? f.index) + '.';

  let list = slots.get(slot);
  if (!list) slots.set(slot, (list = new Set()));

  const entry: Entry = {
    context,
    commit() {
      entry.committed = true;

      for (const e of list) {
        if (e === entry) break;
        if (e.committed) continue;
        e.context.pop();
        list.delete(e);
      }
    },
    remove() {
      list.delete(entry);
    }
  };

  list.add(entry);
  return entry;
}

function component(from: Component, context: Context) {
  const { commit, remove } = register(from, context);
  const { render } = from;
  const Render = () => render.call(from, from.props);
  const Component = () => {
    from = useHook<Component>((refresh) => {
      if (observer(from) !== null)
        watch(from, refresh);
      return () => {
        remove();
        context.pop();
      };
    }) || from;

    useReady(commit);

    const rendered = createElement(Render);

    const children = createElement(Layers().Provider, {
      value: context,
      children: from.fallback === false
        ? rendered
        : createElement(Suspense,
          { fallback: from.fallback, name: String(from) },
          rendered)
    });

    return from.catch
      ? createElement(ErrorBoundary, { self: from, children })
      : children;
  };

  return () => createElement(Component);
}

function subcomponents(proto: Component) {
  do {
    if (SEEN.has(proto)) return;

    SEEN.add(proto);

    for (const key of Object.getOwnPropertyNames(proto))
      if (/^[A-Z]/.test(key)) defineSubcomponent(proto, key);
  } while ((proto = Object.getPrototypeOf(proto)));
}

class ErrorBoundary extends React.Component<{
  self: Component;
  children: React.ReactNode;
}> {
  state = {} as { error?: Error };
  recovering = false;

  constructor(props: ErrorBoundary['props']) {
    super(props);
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    const { self } = this.props;
    const { fallback } = self;
    const reset = (error?: Error) => {
      this.recovering = true;
      this.setState({ error });
    };

    Promise.resolve(self.catch!(error))
      .then(() => reset(), reset)
      .finally(() => self.set({ fallback }, true));
  }

  componentDidUpdate() {
    this.recovering = false;
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.recovering) throw this.state.error;
    return this.props.self.fallback;
  }
}

export { Component };
