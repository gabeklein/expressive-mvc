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

declare module '@expressive/mvc' {
  namespace Model {
    function get<T extends Model>(this: Model.Extends<T>): T;
    function get<T extends Model>(this: Model.Extends<T>, required: false): T | undefined;
    function get<T extends Model>(this: Model.Extends<T>, required: true): Required<T>;
  }

  interface Component {
    mount?(): (() => void) | void;
  }
}

(Model as any).get = function get<T extends Model>(
  this: Model.Extends<T>,
  argument?: boolean
) {
  const scope = requireScope();
  const instance = tracked(scope.context).get(this, argument !== false);

  return instance && tracked(instance, argument === true);
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
