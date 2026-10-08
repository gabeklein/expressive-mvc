import { afterEach, vi } from 'vitest';
import type { Component, State } from '@expressive/mvc';

import { mockPromise } from '../mvc/test.setup';
import { render } from './src/render';
import { vnode } from './src/vnode';

afterEach(() => {
  document.body.replaceChildren();
});

export { mockError, mockPromise, mockWarn, flushMicrotasks } from '../mvc/test.setup';

export const until = <T>(assert: () => T) => vi.waitFor(assert, { interval: 1 });

export function mount<T extends State>(
  Type: new (...args: any[]) => T,
  props?: object,
  root: HTMLElement = document.createElement('main')
): [T, HTMLElement, () => void] {
  let instance!: T;
  const release = render(vnode(Type as any, { ...props, is: (value: T) => (instance = value) }), root);
  return [instance, root, release];
}

export function lazy<T = () => Component.Node>() {
  const loaded = mockPromise<T>();
  return [vi.fn(() => loaded) as () => typeof loaded, loaded] as const;
}

export function track(promise: PromiseLike<unknown>) {
  let settled = false;
  promise.then(() => (settled = true));
  return () => settled;
}

export const html = (root: Element) => root.innerHTML.replace(/<!--[^>]*-->/g, '');
