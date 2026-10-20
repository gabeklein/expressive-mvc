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
let memo: Map<Model, Model>[] | undefined;

function enter<T>(scope: Scope, render: () => T): T {
  const parent = current;
  const releases = collecting;
  const cached = memo;
  const next: (() => void)[] = [];

  current = scope;
  collecting = next;
  memo = [new Map(), new Map()];

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

const forward = Context.get as (...args: unknown[]) => unknown;

Context.get = ((
  arg?: Model | Model.Extends,
  compute?: (context: Context) => unknown,
  required?: boolean
) => {
  if (!current || Context.current || (arg && !compute))
    return forward(arg, compute, required);

  if (!compute) return current.context;

  const found = compute(current.context);

  if (!(found instanceof Model)) return found;

  const cache = memo![required ? 1 : 0];
  let proxy = cache.get(found);

  if (!proxy) cache.set(found, (proxy = tracked(found, required)));

  return proxy;
}) as typeof Context.get;

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
