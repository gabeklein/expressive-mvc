import { fireEvent, within } from '@testing-library/dom';

export const RENDERER = process.env.RENDERER as 'react' | 'dom';
export const errors: unknown[][] = [];

const swapPages = import.meta.glob('@swap/pages/**/App.tsx');
const reactPages = process.env.SWAP ? swapPages : import.meta.glob('../pages/**/App.tsx');
const domPages = process.env.SWAP ? swapPages : import.meta.glob('../pages-dom/**/App.tsx');
const key = (dir: string, page: string) => process.env.SWAP ? Object.keys(swapPages).find((k) => k.endsWith(`/pages/${page}/App.tsx`))! : `../${dir}/${page}/App.tsx`;

let teardown: (() => unknown) | undefined;
let current: HTMLElement | undefined;
export const trail: string[] = [];

export function snap(label: string) {
  if (current) trail.push(`## ${label}\n${current.innerHTML}`);
}

export async function cleanup() {
  current = undefined;
  const t = teardown;
  teardown = undefined;
  if (t) await run(t);
}

async function run(fn: () => unknown) {
  if (RENDERER == 'react') {
    const { act } = await import('react');
    await act(async () => { await fn(); });
  } else {
    await fn();
  }
}

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Let renders, microtasks and short timers flush. */
export async function settle(ms = 0) {
  await run(() => sleep(ms));
  await run(() => sleep(0));
}

/** Mount `pages/<page>/App.tsx` under the active renderer. */
export async function mount(page: string) {
  const container = document.createElement('div');
  document.body.append(container);

  if (RENDERER == 'react') {
    await import('@expressive/react');
    const load = reactPages[key('pages', page)];
    if (!load) throw new Error(`no page ${page}`);
    const { default: App } = (await load()) as any;
    const { createElement, Suspense } = await import('react');
    const { createRoot } = await import('react-dom/client');
    const root = createRoot(container);
    await run(() => root.render(createElement(Suspense, null, createElement(App))));
    teardown = () => root.unmount();
  } else {
    const load = domPages[key('pages-dom', page)];
    if (!load) throw new Error(`no page ${page}`);
    const { default: App } = (await load()) as any;
    const { render } = await import('@expressive/dom');
    const { jsx } = await import('@expressive/dom/jsx-runtime');
    teardown = render(jsx(App, {}), container);
  }

  current = container;
  await settle();
  snap("mount");
  return Object.assign(within(container), { container, text: () => norm(container.textContent) });
}

export const norm = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Interactions; each flushes afterward. */
export const act = {
  async click(el: Element) {
    await run(() => { fireEvent.pointerDown(el); fireEvent.mouseDown(el); fireEvent.pointerUp(el); fireEvent.mouseUp(el); fireEvent.click(el); });
    await settle();
    snap("click");
  },
  async dblclick(el: Element) {
    await run(() => { fireEvent.click(el); fireEvent.click(el); fireEvent.dblClick(el); });
    await settle();
    snap("dblclick");
  },
  /** Type a full value into a text-like field: native setter + input event (+ change on commit). */
  async type(el: Element, value: string, commit = false) {
    await run(() => {
      fireEvent.input(el, { target: { value } });
      if (commit) fireEvent.change(el, { target: { value } });
    });
    await settle();
    snap("type");
  },
  async check(el: Element) {
    await run(() => { fireEvent.click(el); });
    await settle();
    snap("check");
  },
  async key(el: Element, key: string, init: KeyboardEventInit = {}) {
    await run(() => { fireEvent.keyDown(el, { key, ...init }); fireEvent.keyUp(el, { key, ...init }); });
    await settle();
    snap("key");
  },
  async submit(el: Element) {
    await run(() => { fireEvent.submit(el); });
    await settle();
    snap("submit");
  },
  async blur(el: Element) {
    await run(() => { fireEvent.focusOut(el); fireEvent.blur(el); });
    await settle();
    snap("blur");
  },
  async fire(fn: () => unknown, ms = 0) {
    await run(fn);
    await settle(ms);
    snap("fire");
  }
};
