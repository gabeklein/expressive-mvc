import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import type { ResolvedConfig, ViteDevServer, WebSocketClient } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CALL_TIMEOUT, LIST_TIMEOUT, plugin, relay } from './plugin';

function hooks(url = 'file:///app/packages/inspect/dist/vite.js') {
  return plugin(url) as Record<string, any>;
}

describe('plugin', () => {
  it('will apply only to the dev server', () => {
    expect(hooks()).toMatchObject({ name: 'expressive-inspect', apply: 'serve' });
  });

  it('will pre-bundle install and client when installed from node_modules', () => {
    expect(hooks('file:///app/node_modules/@expressive/inspect/dist/vite.js').config()).toEqual({
      optimizeDeps: { include: ['@expressive/inspect/install', '@expressive/inspect/vite/client'] }
    });
  });

  it('will not pre-bundle a linked install', () => {
    expect(hooks().config()).toBeUndefined();
  });

  it('will serve the virtual module', () => {
    const { resolveId, load } = hooks();
    expect(resolveId('virtual:expressive-inspect')).toBe('\0virtual:expressive-inspect');
    expect(resolveId('other')).toBeUndefined();
    expect(load('\0virtual:expressive-inspect')).toContain("import '@expressive/inspect/install'");
    expect(load('other')).toBeUndefined();
  });

  it('will inject the virtual module ahead of the app, under base', () => {
    const { configResolved, transformIndexHtml } = hooks();
    expect(transformIndexHtml()[0]).toMatchObject({
      tag: 'script',
      attrs: { type: 'module', src: '/@id/virtual:expressive-inspect' },
      injectTo: 'head-prepend'
    });
    configResolved({ base: '/app/' } as ResolvedConfig);
    expect(transformIndexHtml()[0].attrs.src).toBe('/app/@id/virtual:expressive-inspect');
  });

  it('will mount the relay', () => {
    const use = vi.fn();
    hooks().configureServer({ middlewares: { use }, ws: { on() {}, clients: new Set() } } as unknown as ViteDevServer);
    expect(use).toHaveBeenCalledWith('/__inspect', expect.any(Function));
  });
});

function setup() {
  const listeners = new Map<string, Function>();
  const clients = new Set<WebSocketClient>();
  const ws = { on: (event: string, fn: Function) => listeners.set(event, fn), clients } as any;
  const handle = relay(ws);

  function page(id: string, respond: (call: any) => unknown = () => ({})) {
    const client = {
      send(_event: string, { rid, call }: { rid: number; call?: unknown }) {
        const answer = respond(call ?? 'info');
        if (answer !== undefined) queueMicrotask(() => listeners.get('expressive-inspect:answer')!({ rid, ...answer }));
      }
    } as unknown as WebSocketClient;

    clients.add(client);
    listeners.get('expressive-inspect:hello')!({ id }, client);
    return client;
  }

  function answer(data: unknown) {
    listeners.get('expressive-inspect:answer')!(data);
  }

  async function request(method: string, url = '/', body = '', headers = {}, remoteAddress: string | null = '127.0.0.1') {
    const req = Object.assign(Readable.from(body ? [body] : []), {
      method,
      url,
      headers,
      socket: { remoteAddress }
    }) as unknown as IncomingMessage;

    const res = {
      statusCode: 0,
      headers: {} as Record<string, string>,
      setHeader(key: string, value: string) {
        this.headers[key] = value;
      },
      end(text: string) {
        this.body = JSON.parse(text);
      },
      body: undefined as any
    };

    await handle(req, res as unknown as ServerResponse);
    return res;
  }

  return { page, clients, answer, request };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('relay', () => {
  it('will list live pages', async () => {
    const { page, request } = setup();
    page('a', () => ({ value: { id: 'a' } }));
    page('b', () => ({ value: { id: 'b' } }));
    const res = await request('GET');
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('application/json');
    expect(res.body).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('will drop a page whose socket closed', async () => {
    const { page, clients, request } = setup();
    clients.delete(page('a', () => ({ value: { id: 'a' } })));
    expect((await request('GET')).body).toEqual([]);
  });

  it('will omit a page that errors or does not answer', async () => {
    vi.useFakeTimers();
    const { page, request } = setup();
    page('a', () => ({ error: 'broken' }));
    page('b', () => undefined);
    const res = request('GET');
    await vi.advanceTimersByTimeAsync(LIST_TIMEOUT);
    expect((await res).body).toEqual([]);
  });

  it('will call a page by id', async () => {
    const { page, request } = setup();
    const respond = vi.fn(() => ({ value: 'typed' }));
    page('a', respond);
    page('b');
    const res = await request('POST', '/a', '["get", "Composer.draft"]');
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('typed');
    expect(respond).toHaveBeenCalledWith([['get'], ['Composer.draft']]);
  });

  it('will split a dotted method into a path', async () => {
    const { page, request } = setup();
    const respond = vi.fn(() => ({ value: [] }));
    page('a', respond);
    await request('POST', '/a?x', '["journal.frames", { "since": 3 }]');
    expect(respond).toHaveBeenCalledWith([['journal', 'frames'], [{ since: 3 }]]);
  });

  it('will call the only page without an id', async () => {
    const { page, request } = setup();
    page('a', () => ({ value: 1 }));
    expect((await request('POST', '/', '["get"]')).body).toBe(1);
  });

  it('will answer null when the page sends no value', async () => {
    const { page, request } = setup();
    page('a', () => ({}));
    expect((await request('POST', '/a', '["set", "x", 1]')).body).toBeNull();
  });

  it('will refuse to guess between several pages', async () => {
    const { page, request } = setup();
    page('a', (call) => (call === 'info' ? { value: { id: 'a' } } : {}));
    page('b', (call) => (call === 'info' ? { value: { id: 'b' } } : {}));
    const res = await request('POST', '/', '["get"]');
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: expect.stringMatching(/Several pages/), pages: [{ id: 'a' }, { id: 'b' }] });
  });

  it('will 404 with no pages connected', async () => {
    const { request } = setup();
    const res = await request('POST', '/', '["get"]');
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'No pages connected.', pages: [] });
  });

  it('will 404 an unknown id', async () => {
    const { page, request } = setup();
    page('a', () => ({ value: { id: 'a' } }));
    const res = await request('POST', '/zz', '["get"]');
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'No page zz.', pages: [{ id: 'a' }] });
  });

  it('will 500 with the page error', async () => {
    const { page, request } = setup();
    page('a', () => ({ error: 'No method at X.y.' }));
    const res = await request('POST', '/a', '["call", "X.y"]');
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'No method at X.y.' });
  });

  it('will 504 when the page does not answer', async () => {
    vi.useFakeTimers();
    const { page, request } = setup();
    page('a', () => undefined);
    const res = request('POST', '/a', '["get"]');
    await vi.advanceTimersByTimeAsync(CALL_TIMEOUT);
    expect((await res).statusCode).toBe(504);
  });

  it('will ignore an answer nobody waits for', async () => {
    const { answer } = setup();
    expect(() => answer({ rid: 99, value: 1 })).not.toThrow();
  });

  it('will 400 a body that is not [method, ...args]', async () => {
    const { request } = setup();
    for (const body of ['', 'nope', '"get"', '{}', '[1]'])
      expect((await request('POST', '/', body)).statusCode).toBe(400);
  });

  it('will 405 other methods', async () => {
    const { request } = setup();
    expect((await request('GET', '/a')).statusCode).toBe(405);
    expect((await request('PUT')).statusCode).toBe(405);
  });

  it('will refuse browser requests', async () => {
    const { request } = setup();
    expect((await request('GET', '/', '', { origin: 'http://evil.test' })).statusCode).toBe(403);
    expect((await request('GET', '/', '', { 'sec-fetch-site': 'same-origin' })).statusCode).toBe(403);
  });

  it('will refuse requests relayed by a proxy or tunnel', async () => {
    const { request } = setup();
    for (const header of ['forwarded', 'x-forwarded-for', 'x-real-ip', 'cf-connecting-ip'])
      expect((await request('GET', '/', '', { [header]: '203.0.113.9' })).statusCode).toBe(403);
  });

  it('will refuse non-loopback callers', async () => {
    const { request } = setup();
    expect((await request('GET', '/', '', {}, '192.168.1.4')).statusCode).toBe(403);
    expect((await request('GET', '/', '', {}, null)).statusCode).toBe(403);
    expect((await request('GET', '/', '', {}, '::1')).statusCode).toBe(200);
    expect((await request('GET', '/', '', {}, '::ffff:127.0.0.1')).statusCode).toBe(200);
  });
});
