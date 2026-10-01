import { Context, State, unbind } from '@expressive/mvc';
import { watch } from '@expressive/mvc/observable';

import { schedule, transition, unschedule } from './scheduler';
import type { Schedulable } from './scheduler';

interface UseState extends State {
  use?(...props: any[]): Promise<void> | void;
  mount?(): (() => void) | void;
}

interface UseSlot {
  Type: State.Type;
  context: Context;
  instance: UseState;
  proxy: State;
  release: () => void;
  mounted?: true;
  cleanup?: (() => void) | void;
  apply: (...args: any[]) => unknown;
}

interface Scope extends Schedulable {
  active: boolean;
  childContext: Context;
  context: Context;
  hot?: boolean;
  kind: 'component' | 'function' | 'collection';
  subscriptions: (() => void)[];
  uses: UseSlot[];
  useIndex: number;
}

let current: Scope | undefined;
let collecting: (() => void)[] | undefined;

function enter<T>(scope: Scope, render: () => T): T {
  const parent = current;
  const releases = collecting;
  const next: (() => void)[] = [];

  current = scope;
  collecting = next;
  scope.childContext = scope.context;
  scope.useIndex = 0;

  try {
    const output = render();

    if (scope.kind == 'function' && scope.useIndex !== scope.uses.length) {
      if (!scope.hot)
        throw new Error('State.use() calls must keep the same order on every function-component render.');

      truncate(scope, scope.useIndex);
    }

    return output;
  } finally {
    scope.hot = undefined;
    current = parent;
    collecting = releases;
    scope.subscriptions.forEach((release) => release());
    scope.subscriptions = next;
  }
}

function dispose(scope: Scope) {
  scope.active = false;
  unschedule(scope);
  scope.subscriptions.forEach((release) => release());
  scope.subscriptions = [];
  truncate(scope, 0);
}

/** Destroy the `State.use()` slots of a scope from `index` on. */
function truncate(scope: Scope, index: number) {
  for (let i = scope.uses.length - 1; i >= index; i--) {
    const slot = scope.uses[i];

    slot.release();
    if (typeof slot.cleanup == 'function') slot.cleanup();
    slot.context.pop();
    slot.instance.set(null);
  }

  scope.uses.length = index;
}

function commit(scope: Scope) {
  for (const slot of scope.uses)
    if (!slot.mounted) {
      slot.mounted = true;
      slot.cleanup = slot.instance.mount?.();
    }
}

function requireScope(): Scope {
  if (!current)
    throw new Error('State.get() and State.use() may only run while @expressive/dom is rendering.');

  return current;
}

function tracked<T extends object>(target: T, required?: boolean): T {
  const scope = requireScope();
  let proxy = target;
  let first = true;

  const release = watch(
    target,
    (next) => {
      proxy = next;
      if (!first && scope.active) schedule(scope);
      first = false;
    },
    required,
    transition
  );

  collecting!.push(release);
  return proxy;
}

type NoVoid<T> = T extends undefined | void ? null : T;

declare module '@expressive/mvc' {
  interface UseState extends State {
    use?(...props: any[]): Promise<void> | void;
    mount?(): (() => void) | void;
  }

  namespace State {
    type ForceRefresh = {
      (): void;
      <T = void>(waitFor: Promise<T>): Promise<T>;
      <T = void>(invoke: () => Promise<T>): Promise<T>;
    };

    type GetFactory<T extends State, R> = (
      this: T,
      current: T,
      refresh: ForceRefresh
    ) => R;

    type UseArgs<T extends State> = T extends { use(...props: infer P): any }
      ? P
      : State.Args<T>;

    function get<T extends State>(this: State.Extends<T>): T;
    function get<T extends State>(this: State.Extends<T>, required: false): T | undefined;
    function get<T extends State>(this: State.Extends<T>, required: true): Required<T>;
    function get<T extends State, R>(
      this: State.Extends<T>,
      factory: GetFactory<T, R>
    ): NoVoid<R>;
    function use<T extends UseState>(
      this: State.Type<T>,
      ...args: UseArgs<T>
    ): T;
  }

  interface Component {
    mount?(): (() => void) | void;
  }
}

(State as any).get = function get<T extends State>(
  this: State.Extends<T>,
  argument?: boolean | State.GetFactory<T, unknown>
) {
  const scope = requireScope();
  const instance = scope.childContext.get(this, argument === false ? false : true);

  if (!instance) return undefined;

  const proxy = tracked(instance, argument === true);

  if (typeof argument != 'function') return proxy;

  const refresh = ((action?: Promise<unknown> | (() => Promise<unknown>)) => {
    if (typeof action == 'function') action = action();
    schedule(scope);
    return action instanceof Promise ? action.finally(() => schedule(scope)) : undefined;
  }) as State.ForceRefresh;

  return argument.call(proxy, proxy, refresh) ?? null;
};

(State as any).use = function use<T extends UseState>(
  this: State.Type<T>,
  ...args: State.UseArgs<T>
) {
  const scope = requireScope();

  if (scope.kind != 'function')
    throw new Error('State.use() is only available at the top level of a function component.');

  const index = scope.useIndex++;
  let slot = scope.uses[index] as UseSlot | undefined;

  if (slot && slot.Type !== this) {
    if (!scope.hot)
      throw new Error('State.use() calls must keep the same order on every function-component render.');

    truncate(scope, index);
    slot = undefined;
  }

  if (!slot) {
    let instance!: T;
    const assign = (value: unknown) =>
      typeof value == 'object' && value && instance.set(value as State.Assign<T>);
    let apply: (...values: any[]) => unknown = (...values) =>
      Promise.all(values.flat().map(assign));

    instance = new (this as any)((self: T) => {
      const own = self as T & UseState;

      if (typeof own.use == 'function') {
        apply = own.use.bind(own);
        apply(...args);
        return;
      }

      return args;
    });
    const context = scope.childContext.push(instance);

    slot = {
      Type: this,
      context,
      instance,
      proxy: instance,
      release: undefined!,
      apply
    };

    let first = true;
    slot.release = watch(instance, (proxy) => {
      slot!.proxy = proxy;

      if (!first && scope.active) schedule(scope);
      first = false;
    }, undefined, transition);

    slot.apply = apply;
    scope.uses.push(slot);
  } else {
    slot.apply(...args);
  }

  scope.childContext = slot.context;
  return slot.proxy as T;
};

const OWNERS = new WeakMap<Function, { owner: State; key: string }>();

State.on({
  bind(key, fn) {
    if (/^[A-Z]/.test(key)) OWNERS.set(fn, { owner: this, key });
  }
});

function call(type: Function, props: unknown) {
  const sub = OWNERS.get(type);

  if (!sub) return type(props);

  const { owner, key } = sub;
  return unbind((owner as any)[key]).call(tracked(owner), props);
}

function owner(type: unknown) {
  return typeof type == 'function' ? OWNERS.get(type) : undefined;
}

export { call, commit, dispose, enter, owner };
export type { Scope };
