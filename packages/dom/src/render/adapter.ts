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
let memo: Map<object, object> | undefined;

function enter<T>(scope: Scope, render: () => T): T {
  const parent = current;
  const releases = collecting;
  const cached = memo;
  const next: (() => void)[] = [];

  current = scope;
  collecting = next;
  memo = new Map();

  try {
    return render();
  } finally {
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
}

function tracked<T extends object>(target: T, required?: boolean): T {
  const scope = current!;
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
  interface Component {
    mount?(): (() => void) | void;
  }
}

const normal = Context.resolve;

Context.resolve = (Type, compute) => {
  if (!current) return normal(Type, compute);

  const found = compute(Type ? cache(current.context) : current.context);

  return found instanceof Model ? cache(found) : found;
};

function cache<T extends object>(target: T): T {
  let proxy = memo!.get(target);

  if (!proxy) memo!.set(target, (proxy = tracked(target, false)));

  return proxy as T;
}

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
