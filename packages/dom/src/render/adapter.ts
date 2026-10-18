import { Component, Context, Model, unbind } from '@expressive/mvc';
import { provide } from '@expressive/mvc/getter';
import { watch } from '@expressive/mvc/observable';

import { schedule, transition, unschedule } from './scheduler';
import type { Schedulable } from './scheduler';

interface UseModel extends Model {
  use?(...props: any[]): Promise<void> | void;
  mount?(): (() => void) | void;
}

interface UseSlot {
  Type: Model.Type;
  context: Context;
  instance: UseModel;
  proxy: Model;
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
let memo: Map<Model, Model>[] | undefined;

function enter<T>(scope: Scope, render: () => T): T {
  const parent = current;
  const releases = collecting;
  const cached = memo;
  const next: (() => void)[] = [];

  current = scope;
  collecting = next;
  memo = [new Map(), new Map()];
  scope.childContext = scope.context;
  scope.useIndex = 0;

  try {
    const output = render();

    if (scope.kind == 'function' && scope.useIndex !== scope.uses.length) {
      if (!scope.hot)
        throw new Error('Model.use() calls must keep the same order on every function-component render.');

      truncate(scope, scope.useIndex);
    }

    return output;
  } finally {
    scope.hot = undefined;
    current = parent;
    collecting = releases;
    memo = cached;
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

/** Destroy the `Model.use()` slots of a scope from `index` on. */
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
    throw new Error('Model.use() may only run while @expressive/dom is rendering.');

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

declare module '@expressive/mvc' {
  interface UseModel extends Model {
    use?(...props: any[]): Promise<void> | void;
    mount?(): (() => void) | void;
  }

  namespace Model {
    type UseArgs<T extends Model> = T extends { use(...props: infer P): any }
      ? P
      : Model.Args<T>;

    function use<T extends UseModel>(
      this: Model.Type<T>,
      ...args: UseArgs<T>
    ): T;
  }

  namespace Component {
    const use: never;
  }

  interface Component {
    mount?(): (() => void) | void;
  }
}

provide((_Type, lookup, next, requireValues) => {
  if (!current) return next();

  const found = lookup(current.childContext);

  if (!(found instanceof Model)) return found;

  const cache = memo![requireValues ? 1 : 0];
  let proxy = cache.get(found);

  if (!proxy) cache.set(found, (proxy = tracked(found, requireValues)));

  return proxy;
});

(Model as any).use = function use<T extends UseModel>(
  this: Model.Type<T>,
  ...args: Model.UseArgs<T>
) {
  const scope = requireScope();

  if (scope.kind != 'function')
    throw new Error('Model.use() is only available at the top level of a function component.');

  const index = scope.useIndex++;
  let slot = scope.uses[index] as UseSlot | undefined;

  if (slot && slot.Type !== this) {
    if (!scope.hot)
      throw new Error('Model.use() calls must keep the same order on every function-component render.');

    truncate(scope, index);
    slot = undefined;
  }

  if (!slot) {
    let instance!: T;
    const assign = (value: unknown) =>
      typeof value == 'object' && value && instance.set(value as Model.Assign<T>);
    let apply: (...values: any[]) => unknown = (...values) =>
      Promise.all(values.flat().map(assign));

    instance = new (this as any)((self: T) => {
      const own = self as T & UseModel;

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

Object.defineProperty(Component, 'use', {
  configurable: true,
  value() {
    throw new Error(`${this} is a Component - render it instead of calling use().`);
  }
});

const OWNERS = new WeakMap<Function, { owner: Model; key: string }>();

Model.on({
  method(key, fn, owner) {
    if (/^[A-Z]/.test(key)) OWNERS.set(fn, { owner, key });
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
