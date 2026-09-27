import React, { Suspense } from 'react';
import { State, Provider } from '.';
import { pending } from '@expressive/mvc';
import { expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { mockPromise } from '../test.setup';

const tick = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

class Nav extends State {
  page = 'a';
}

class Clock extends State {
  now = 0;
}

it('R1 superseding transition', async () => {
  const nav = Nav.new();
  const gate = mockPromise<void>();
  const Page = () => {
    const { page } = Nav.get();
    if (page == 'b') throw gate;
    return <p>{page}</p>;
  };
  const view = render(
    <Provider for={nav}><Suspense fallback={<i>loading</i>}><Page /></Suspense></Provider>
  );

  await act(async () => { pending(() => { nav.page = 'b'; }); await tick(); });
  expect(view.container.textContent).toBe('a');

  let settled = false;
  await act(async () => { pending(() => { nav.page = 'c'; }).then(() => (settled = true)); await tick(); });
  expect(view.container.textContent).toBe('c');
  expect(settled).toBe(true);
});

it('R2 back to current', async () => {
  const nav = Nav.new();
  const gate = mockPromise<void>();
  const Page = () => {
    const { page } = Nav.get();
    if (page == 'b') throw gate;
    return <p>{page}</p>;
  };
  const view = render(
    <Provider for={nav}><Suspense fallback={<i>loading</i>}><Page /></Suspense></Provider>
  );

  await act(async () => { pending(() => { nav.page = 'b'; }); await tick(); });
  let settled = false;
  await act(async () => { pending(() => { nav.page = 'a'; }).then(() => (settled = true)); await tick(); });
  expect(view.container.textContent).toBe('a');
  expect(settled).toBe(true);
});

it('R3 clock tick during sibling swap', async () => {
  const nav = Nav.new();
  const clock = Clock.new();
  const gate = mockPromise<void>();
  const A = () => {
    const { now } = Clock.get();
    return Nav.get().page == 'a' ? <p>A{now}</p> : null;
  };
  const B = () => {
    if (Nav.get().page != 'b') return null;
    throw gate;
  };
  const view = render(
    <Provider for={{ nav, clock }}><Suspense fallback={<i>loading</i>}><div><A /><B /></div></Suspense></Provider>
  );

  await act(async () => { pending(() => { nav.page = 'b'; }); await tick(); });
  expect(view.container.textContent).toBe('A0');
  await act(async () => { clock.now = 1; await tick(); });
  expect(view.container.textContent).toMatch(/^A|loading/);
});

it('R7 retry re-render count', async () => {
  const nav = Nav.new();
  let gate = mockPromise<void>();
  let tries = 0;
  let renders = 0;
  const Other = () => { renders++; Nav.get().page; return null; };
  const Page = () => {
    const { page } = Nav.get();
    if (page == 'b' && tries < 3) { tries++; throw gate; }
    return <p>{page}</p>;
  };
  const view = render(
    <Provider for={nav}><Suspense fallback={<i>loading</i>}><Other /><Page /></Suspense></Provider>
  );
  renders = 0;
  await act(async () => { pending(() => { nav.page = 'b'; }); await tick(); });
  for (let i = 0; i < 3; i++) {
    await act(async () => { const c = gate; gate = mockPromise<void>(); c.resolve(); await tick(); });
  }
  expect(view.container.textContent).toBe('b');
  expect(renders).toBe(-1);
});

it('R5 hidden content stays connected', async () => {
  const nav = Nav.new();
  const gate = mockPromise<void>();
  let node: HTMLElement | null = null;
  const Gate = () => { if (Nav.get().page == 'b') throw gate; return null; };
  const view = render(
    <Provider for={nav}><Suspense fallback={<i>loading</i>}><div ref={(n) => { if (n) node = n; }}>content</div><Gate /></Suspense></Provider>
  );
  await act(async () => { nav.page = 'b'; await tick(); });
  expect(view.container.textContent).toContain('loading');
  expect(node!.isConnected).toBe(true);
  expect(node!.style.display).toBe('none');
});
