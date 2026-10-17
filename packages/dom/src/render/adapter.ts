import { Context, Model, unbind } from '@expressive/mvc';
import { watch } from '@expressive/mvc/observable';

import { schedule, transition, unschedule } from './scheduler';
import type { Schedulable } from './scheduler';

interface Scope extends Schedulable {
  active: boolean;
  context: Context;
  subscriptions: (() => void)[];
}

let current: Scope | undefined;
let collecting: (() => void)[] | undefined;

function enter<T>(scope: Scope, render: () => T): T {
  const parent = current;
  const releases = collecting;
  const next: (() => void)[] = [];

  current = scope;
  collecting = next;

  try {
    return render();
  } finally {
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
}

function requireScope(): Scope {
  if (!current)
    throw new Error('Model.get() may only run while @expressive/dom is rendering.');

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
  namespace Model {
    type ForceRefresh = {
      (): void;
      <T = void>(waitFor: Promise<T>): Promise<T>;
      <T = void>(invoke: () => Promise<T>): Promise<T>;
    };

    type GetFactory<T extends Model, R> = (
      this: T,
      current: T,
      refresh: ForceRefresh
    ) => R;

    function get<T extends Model>(this: Model.Extends<T>): T;
    function get<T extends Model>(this: Model.Extends<T>, required: false): T | undefined;
    function get<T extends Model>(this: Model.Extends<T>, required: true): Required<T>;
    function get<T extends Model, R>(
      this: Model.Extends<T>,
      factory: GetFactory<T, R>
    ): NoVoid<R>;
  }

  interface Component {
    mount?(): (() => void) | void;
  }
}

(Model as any).get = function get<T extends Model>(
  this: Model.Extends<T>,
  argument?: boolean | Model.GetFactory<T, unknown>
) {
  const scope = requireScope();
  const instance = scope.context.get(this, argument === false ? false : true);

  if (!instance) return undefined;

  const proxy = tracked(instance, argument === true);

  if (typeof argument != 'function') return proxy;

  const refresh = ((action?: Promise<unknown> | (() => Promise<unknown>)) => {
    if (typeof action == 'function') action = action();
    schedule(scope);
    return action instanceof Promise ? action.finally(() => schedule(scope)) : undefined;
  }) as Model.ForceRefresh;

  return argument.call(proxy, proxy, refresh) ?? null;
};

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

export { call, dispose, enter, owner };
export type { Scope };
