import { event } from './observable';
import {
  State,
  PARENT,
  REGISTRY,
  CHILDREN,
  CTX_CLEANUP,
  INPUTS,
  include
} from './state';

import type { Expect } from './state';

declare namespace Context {
  type Accept<T extends State = State> =
    | T
    | State.Type<T>
    | Record<string | number, T | State.Type<T>>;

  type Expect<T extends State = State> = import('./state').Expect<T>;
}

class Context extends State {
  static root: Context;

  constructor(arg?: Context | Context.Accept) {
    super();
    REGISTRY.set(this, new Map());
    CTX_CLEANUP.set(this, new Map());

    if (arg instanceof Context) {
      PARENT.set(this, arg);
      let children = CHILDREN.get(arg);
      if (!children) CHILDREN.set(arg, (children = new Set()));
      children.add(this);
    }

    event(this);

    if (arg && !(arg instanceof Context)) this.use(arg);
  }

  public use<T extends State>(
    inputs: Context.Accept<T>,
    forEach?: Expect<T>
  ) {
    const cleanup = CTX_CLEANUP.get(this)!;
    const prevInputs = INPUTS.get(this) || {};
    const init = new Set<State>();

    if (typeof inputs == 'function' || inputs instanceof State)
      inputs = { [0]: inputs };

    for (const K of Object.keys({ ...prevInputs, ...inputs })) {
      const V = (inputs as any)[K];
      const E = prevInputs[K];

      if (E === V) continue;

      if (E) {
        cleanup.get(K)?.();
        cleanup.delete(K);
      }

      if (!V) continue;

      if (!(State.is(V) || V instanceof State))
        throw new Error(
          `Context can only include an instance or class of State but got ${
            K == '0' || K == String(V) ? V : `${V} (as '${K}')`
          }.`
        );

      const state = State.is(V) ? new (V as State.Type)() : V;
      const remove = this.add(state, false);

      init.add(state);
      cleanup.set(
        K,
        state === V
          ? remove
          : () => {
              remove();
              event(state, null);
            }
      );
    }

    for (const state of init) {
      event(state);
      if (forEach) forEach(state as T, false, false);
    }

    INPUTS.set(this, inputs as Record<string | number, State | State.Extends>);

    return this;
  }

  add(I: State, implicit?: boolean) {
    return include(this, I, implicit);
  }

  public push(inputs?: Context.Accept) {
    const next = new Context(this);
    if (inputs) next.use(inputs);
    return next;
  }

  public pop() {
    INPUTS.set(this, {});
    const children = CHILDREN.get(this);
    if (children) {
      for (const child of [...children]) (child as Context).pop();
      children.clear();
    }
    const cleanup = CTX_CLEANUP.get(this);
    if (cleanup) {
      cleanup.forEach((cb) => cb());
      cleanup.clear();
    }
    const parent = PARENT.get(this);
    if (parent) CHILDREN.get(parent)?.delete(this);
  }
}

Context.root = new Context();

export { Context };
