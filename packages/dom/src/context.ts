import { Context, State } from '@expressive/mvc';
import type { Component, UseState } from '@expressive/mvc';

import type { Node } from './vnode';

namespace Consumer {
  export interface Props<T extends State> {
    for: State.Extends<T>;
    children: (value: T) => Node;
  }
}

function Consumer<T extends State>(props: Consumer.Props<T>): Node {
  return props.for.get((value) => props.children(value));
}

namespace Provider {
  export type ForEach<T extends State> = (state: T) => void;

  export interface SharedProps {
    children?: Node;
    fallback?: Node;
    name?: string;
  }

  export type Props<T extends State = State> = SharedProps & {
    for: Context.Accept<T>;
    is?: ForEach<T>;
  } & Record<string, unknown>;
}

function Provider<T extends State>(_props: Provider.Props<T>): Component.Node {
  throw new Error('Provider must be rendered by @expressive/dom.');
}

function provide<T extends State>(context: Context, props: Provider.Props<T>) {
  const { for: input, is, children: _children, fallback: _fallback, name: _name, ...rest } = props;
  const mount: (() => void)[] = [];
  let single: State | undefined;
  const solo = State.is(input) || input instanceof State;

  context.set(input, (state, owned) => {
    if (solo) single = state;
    is?.(state as T);

    if (owned) {
      let cleanup: (() => void) | void;
      mount.push(() => {
        cleanup = (state as UseState).mount?.();
      });
      return () => cleanup?.();
    }
  });

  if (solo && !single) {
    const Type = (input instanceof State ? input.constructor : input) as State.Extends<T>;
    single = context.get(Type, false);
  }

  if (single && Object.keys(rest).length) single.set(rest);

  return () => mount.forEach((commit) => commit());
}

export { Consumer, Provider, provide };
