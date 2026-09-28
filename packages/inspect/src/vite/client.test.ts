import { State } from '@expressive/mvc';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { attach, inspect, journal } from '../index';
import { connect, type Hot } from './client';

class Composer extends State {
  draft = '';

  submit(text: string) {
    this.draft = text;
    return text.length;
  }
}

function channel() {
  const listeners = new Map<string, (data: any) => unknown>();
  const sent: [string, any][] = [];
  const hot: Hot = {
    on: (event, listener) => void listeners.set(event, listener),
    send: (event, data) => void sent.push([event, data])
  };

  const emit = (event: string, data?: unknown) => listeners.get(event)!(data);

  async function ask(rid: number, call?: unknown) {
    await listeners.get('expressive-inspect:ask')!({ rid, call });
    return sent.at(-1)![1];
  }

  return { hot, sent, ask, emit };
}

beforeEach(() => {
  const window = { self: {}, top: {} };
  window.top = window.self;
  vi.stubGlobal('window', window);
  vi.stubGlobal('location', { href: 'http://localhost/page' });
  vi.stubGlobal('document', { title: 'Page' });
  globalThis.__EXPRESSIVE_INSPECT__ = inspect;
  attach();
});

afterEach(() => {
  vi.unstubAllGlobals();
  globalThis.__EXPRESSIVE_INSPECT__ = undefined;
});

describe('connect', () => {
  it('will announce itself with an id', () => {
    const { hot, sent } = channel();
    connect(hot);
    expect(sent).toEqual([['expressive-inspect:hello', { id: expect.any(String) }]]);
  });

  it('will describe the page when asked without a call', async () => {
    const { hot, sent, ask } = channel();
    connect(hot);
    const { id } = sent[0][1];
    expect(await ask(1)).toEqual({ rid: 1, value: { id, url: 'http://localhost/page', title: 'Page', top: true } });
  });

  it('will report a nested frame', async () => {
    vi.stubGlobal('window', { self: {}, top: {} });
    const { hot, ask } = channel();
    connect(hot);
    expect((await ask(1)).value.top).toBe(false);
  });

  it('will record keys once connected', () => {
    connect(channel().hot);
    expect(journal.record().level).toBe('keys');
  });

  it('will keep a recording level already set', () => {
    journal.record({ level: 'values' });
    connect(channel().hot);
    expect(journal.record().level).toBe('values');
  });

  it('will act on a call and answer its value and frames', async () => {
    Composer.new();
    const { hot, ask } = channel();
    connect(hot);
    const { value } = await ask(1, [['act'], [['call', 'Composer.submit', 'hi']]]);
    expect(value.value).toBe(2);
    expect(value.frames[0].events[0]).toMatchObject({ key: 'draft', value: 'hi' });
    expect(value.settled).toBe(true);
    expect(value.pending).toEqual([]);
    expect(value.missing).toEqual([]);
    expect(journal.record().level).toBe('keys');
  });

  it('will answer settled false when work outlasts the timeout', async () => {
    const composer = Composer.new();
    const { hot, ask } = channel();
    connect(hot);
    const loop = setInterval(() => composer.draft += '.', 0);
    try {
      const { value } = await ask(1, [['act'], [['get', 'Composer.draft'], { timeout: 20 }]]);
      expect(value.settled).toBe(false);
    } finally {
      clearInterval(loop);
    }
  });

  it('will answer the targets that never saw a frame', async () => {
    Composer.new();
    const { hot, ask } = channel();
    connect(hot);
    const { value } = await ask(1, [['act'], [['get', 'Composer.draft'], { until: 'Composer.draft', timeout: 20 }]]);
    expect(value).toMatchObject({ settled: false, pending: ['Composer.draft'] });
  });

  it('will answer value targets that name no instance', async () => {
    const { hot, ask } = channel();
    connect(hot);
    const { value } = await ask(1, [['act'], [['get', 'Composer.draft'], { until: { 'Missing.draft': 'x' }, timeout: 20 }]]);
    expect(value).toMatchObject({ settled: false, pending: ['Missing.draft'], missing: ['Missing.draft'] });
  });

  it('will act until an address holds a value', async () => {
    const composer = Composer.new();
    const { hot, ask } = channel();
    connect(hot);
    setTimeout(() => (composer.draft = 'ready'), 10);
    const { value } = await ask(1, [['act'], [['get', 'Composer.draft'], { until: { 'Composer.draft': 'ready' } }]]);
    expect(value).toMatchObject({ settled: true, pending: [] });
  });

  it('will answer an error for act without a call', async () => {
    const { hot, ask } = channel();
    connect(hot);
    expect(await ask(1, [['act'], ['Composer.submit']])).toEqual({
      rid: 1,
      error: 'act takes one call: ["act", [method, ...args], options?].'
    });
  });

  it('will answer a call through the dispatcher', async () => {
    const composer = Composer.new();
    const { hot, ask } = channel();
    connect(hot);
    expect(await ask(1, [['get'], ['Composer.draft']])).toEqual({ rid: 1, value: '' });
    expect(await ask(2, [['call'], ['Composer.submit', 'hi']])).toEqual({ rid: 2, value: 2 });
    expect(composer.draft).toBe('hi');
  });

  it('will answer null for an undefined result', async () => {
    Composer.new();
    const { hot, ask } = channel();
    connect(hot);
    expect(await ask(1, [['set'], ['Composer.draft', 'x']])).toEqual({ rid: 1, value: null });
  });

  it('will answer an error when the call throws', async () => {
    const { hot, ask } = channel();
    connect(hot);
    expect(await ask(1, [['call'], ['Missing.method']])).toEqual({ rid: 1, error: 'No method at Missing.method.' });
  });

  it('will answer an error when the result does not serialize', async () => {
    const { hot, ask } = channel();
    connect(hot);
    globalThis.__EXPRESSIVE_INSPECT__ = { big: () => 1n } as never;
    expect((await ask(1, [['big'], []])).error).toMatch(/BigInt/);
  });

  it('will answer an error for a non-Error throw', async () => {
    const { hot, ask } = channel();
    connect(hot);
    globalThis.__EXPRESSIVE_INSPECT__ = {
      fail() {
        throw 'plain';
      }
    } as never;
    expect(await ask(1, [['fail'], []])).toEqual({ rid: 1, error: 'plain' });
  });
});

describe('hot', () => {
  function storage() {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
      removeItem: (key: string) => void values.delete(key)
    };
  }

  const reloads = () =>
    journal.frames().flatMap((frame) => frame.events).filter((event) => event.key == 'reload');

  beforeEach(() => journal.reset());

  it('will record a hot update', () => {
    const { hot, emit } = channel();

    connect(hot);
    emit('vite:beforeUpdate', { updates: [{ path: '/src/app.ts' }] });

    expect(journal.frames().at(-1)!.events.at(-1)).toEqual({
      id: '', type: 'vite', key: 'update', kind: 'hot', value: ['/src/app.ts']
    });
  });

  it('will carry a full reload into the next page', () => {
    vi.stubGlobal('sessionStorage', storage());

    const first = channel();

    connect(first.hot);
    first.emit('vite:beforeFullReload', { path: '/src/model.ts', triggeredBy: '/src/model.ts' });

    journal.reset();
    connect(channel().hot);

    expect(reloads()).toEqual([
      { id: '', type: 'vite', key: 'reload', kind: 'hot', value: { path: '/src/model.ts', triggeredBy: '/src/model.ts' } }
    ]);

    journal.reset();
    connect(channel().hot);

    expect(reloads()).toEqual([]);
  });

  it('will carry a reload a plugin announced', () => {
    const listeners = new Map<string, (event: unknown) => void>();

    vi.stubGlobal('sessionStorage', storage());
    vi.stubGlobal('addEventListener', (name: string, listener: (event: unknown) => void) => listeners.set(name, listener));

    connect(channel().hot);
    listeners.get('expressive:reload')!({ detail: { module: '/src/model.ts', export: 'Store', reason: 'class changed shape' } });

    journal.reset();
    connect(channel().hot);

    expect(reloads()[0].value).toEqual({ module: '/src/model.ts', export: 'Store', reason: 'class changed shape' });
  });

  it('will remember a reload without detail', () => {
    vi.stubGlobal('sessionStorage', storage());

    const first = channel();

    connect(first.hot);
    first.emit('vite:beforeFullReload');

    journal.reset();
    connect(channel().hot);

    expect(reloads()[0].value).toEqual({});
  });

  it('will do without session storage', () => {
    const first = channel();

    connect(first.hot);

    expect(() => first.emit('vite:beforeFullReload', {})).not.toThrow();
  });
});
