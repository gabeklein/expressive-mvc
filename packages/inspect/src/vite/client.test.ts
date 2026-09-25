import { State } from '@expressive/mvc';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { attach, inspect } from '../index';
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

  async function ask(rid: number, call?: unknown) {
    await listeners.get('expressive-inspect:ask')!({ rid, call });
    return sent.at(-1)![1];
  }

  return { hot, sent, ask };
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
    globalThis.__EXPRESSIVE_INSPECT__ = { big: () => 1n } as never;
    const { hot, ask } = channel();
    connect(hot);
    expect((await ask(1, [['big'], []])).error).toMatch(/BigInt/);
  });

  it('will answer an error for a non-Error throw', async () => {
    globalThis.__EXPRESSIVE_INSPECT__ = {
      fail() {
        throw 'plain';
      }
    } as never;
    const { hot, ask } = channel();
    connect(hot);
    expect(await ask(1, [['fail'], []])).toEqual({ rid: 1, error: 'plain' });
  });
});
