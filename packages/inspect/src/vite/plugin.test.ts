import { mkdtempSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import type { ResolvedConfig, ViteDevServer, WebSocketClient } from 'vite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushMicrotasks } from '../../test.setup';
import { CALL_TIMEOUT, LIST_TIMEOUT, panel, plugin, relay } from './plugin';

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

  it('will mount the panel and relay under one route', () => {
    const use = vi.fn();
    hooks().configureServer({ middlewares: { use }, ws: { on() {}, clients: new Set() } } as unknown as ViteDevServer);
    expect(use).toHaveBeenCalledWith('/__inspect', expect.any(Function));

    const res = { statusCode: 0, setHeader: vi.fn(), end: vi.fn() };
    use.mock.calls[0][1]({ method: 'GET', url: '/ui', headers: {}, socket: {} }, res);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('__EXPRESSIVE_DEVTOOLS__'));
  });

  it('will read the websocket token when vite provides one', () => {
    const { configResolved } = hooks();
    configResolved({ base: '/', webSocketToken: 'v-token' } as ResolvedConfig);
  });
});

describe('panel', () => {
  const context = { base: '/', token: 't', ws: 'v-token' };

  function request(method: string, url = '/', handle = panel('file:///missing/dist/vite.js', () => context)) {
    const req = { method, url } as IncomingMessage;
    const res = {
      statusCode: 0,
      headers: {} as Record<string, string>,
      setHeader(key: string, value: string) {
        this.headers[key] = value;
      },
      end(text?: string) {
        this.body = text;
      },
      body: undefined as any
    };

    handle(req, res as unknown as ServerResponse);
    return res;
  }

  it('will serve the page with its join and upgrade tokens', () => {
    const res = request('GET', '/ui');
    expect(res.headers['Content-Type']).toBe('text/html');
    expect(res.body).toContain('"token":"t"');
    expect(res.body).toContain('"ws":"v-token"');
    expect(res.body).toContain('/__inspect/ui.js');
  });

  it('will serve the bundle beside the entry or under the package dist', () => {
    const dir = mkdtempSync(`${tmpdir()}/inspect-ui-`);
    writeFileSync(`${dir}/ui.js`, 'bundle!');

    const res = request('GET', '/ui.js', panel(`file://${dir}/vite.js`, () => context));
    expect(res.headers['Content-Type']).toBe('text/javascript');
    expect(String(res.body)).toBe('bundle!');
  });

  it('will 404 a missing bundle, unknown path, or non-GET', () => {
    expect(request('GET', '/ui.js').statusCode).toBe(404);
    expect(request('GET', '/other').statusCode).toBe(404);
    expect(request('POST', '/ui').statusCode).toBe(404);
  });
});

function setup(options?: { token?: string }) {
  const listeners = new Map<string, Function>();
  const clients = new Set<WebSocketClient>();
  const ws = { on: (event: string, fn: Function) => listeners.set(event, fn), clients } as any;
  const handle = relay(ws, options);

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

  function ui(token?: string) {
    const sent: { event: string; data: any }[] = [];
    const client = { send: (event: string, data: unknown) => void sent.push({ event, data }) } as unknown as WebSocketClient;

    clients.add(client);
    listeners.get('expressive-inspect:join')!({ token }, client);
    return {
      client,
      sent,
      forward: (data: unknown) => listeners.get('expressive-inspect:forward')!(data, client)
    };
  }

  function disconnect(client: WebSocketClient) {
    clients.delete(client);
    listeners.get('vite:client:disconnect')!(undefined, client);
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

  return { page, ui, clients, disconnect, answer, request };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('relay', () => {
  let { page, clients, answer, request } = setup();

  beforeEach(() => void ({ page, clients, answer, request } = setup()));

  it('will list live pages', async () => {
    page('a', () => ({ value: { id: 'a' } }));
    page('b', () => ({ value: { id: 'b' } }));
    const res = await request('GET');
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('application/json');
    expect(res.body).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('will drop a page whose socket closed', async () => {
    clients.delete(page('a', () => ({ value: { id: 'a' } })));
    expect((await request('GET')).body).toEqual([]);
  });

  it('will omit a page that errors or does not answer', async () => {
    vi.useFakeTimers();
    page('a', () => ({ error: 'broken' }));
    page('b', () => undefined);
    const res = request('GET');
    await vi.advanceTimersByTimeAsync(LIST_TIMEOUT);
    expect((await res).body).toEqual([]);
  });

  it('will call a page by id', async () => {
    const respond = vi.fn(() => ({ value: 'typed' }));
    page('a', respond);
    page('b');
    const res = await request('POST', '/a', '["get", "Composer.draft"]');
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('typed');
    expect(respond).toHaveBeenCalledWith([['get'], ['Composer.draft']]);
  });

  it('will split a dotted method into a path', async () => {
    const respond = vi.fn(() => ({ value: [] }));
    page('a', respond);
    await request('POST', '/a?x', '["journal.frames", { "since": 3 }]');
    expect(respond).toHaveBeenCalledWith([['journal', 'frames'], [{ since: 3 }]]);
  });

  it('will call the only page without an id', async () => {
    page('a', () => ({ value: 1 }));
    expect((await request('POST', '/', '["get"]')).body).toBe(1);
  });

  it('will answer null when the page sends no value', async () => {
    page('a', () => ({}));
    expect((await request('POST', '/a', '["set", "x", 1]')).body).toBeNull();
  });

  it('will refuse to guess between several pages', async () => {
    page('a', (call) => (call === 'info' ? { value: { id: 'a' } } : {}));
    page('b', (call) => (call === 'info' ? { value: { id: 'b' } } : {}));
    const res = await request('POST', '/', '["get"]');
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: expect.stringMatching(/Several pages/), pages: [{ id: 'a' }, { id: 'b' }] });
  });

  it.each([
    ['404 with no pages connected', undefined, '/', 404, { error: 'No pages connected.', pages: [] }],
    ['404 an unknown id', () => ({ value: { id: 'a' } }), '/zz', 404, { error: 'No page zz.', pages: [{ id: 'a' }] }],
    ['500 with the page error', () => ({ error: 'No method at X.y.' }), '/a', 500, { error: 'No method at X.y.' }]
  ])('will %s', async (_, respond, path, status, body) => {
    if (respond) page('a', respond);
    const res = await request('POST', path, '["get"]');
    expect(res.statusCode).toBe(status);
    expect(res.body).toEqual(body);
  });

  it('will 504 when the page does not answer', async () => {
    vi.useFakeTimers();
    page('a', () => undefined);
    const res = request('POST', '/a', '["get"]');
    await vi.advanceTimersByTimeAsync(CALL_TIMEOUT);
    expect((await res).statusCode).toBe(504);
  });

  it('will ignore an answer nobody waits for', async () => {
    expect(() => answer({ rid: 99, value: 1 })).not.toThrow();
  });

  it('will 400 a body that is not [method, ...args]', async () => {
    for (const body of ['', 'nope', '"get"', '{}', '[1]'])
      expect((await request('POST', '/', body)).statusCode).toBe(400);
  });

  it('will 405 other methods', async () => {
    expect((await request('GET', '/a')).statusCode).toBe(405);
    expect((await request('PUT')).statusCode).toBe(405);
  });

  it.each([
    ['a browser origin', { origin: 'http://evil.test' }, '127.0.0.1', 403],
    ['a browser fetch', { 'sec-fetch-site': 'same-origin' }, '127.0.0.1', 403],
    ...['forwarded', 'x-forwarded-for', 'x-real-ip', 'cf-connecting-ip'].map(
      (header) => [`a request relayed with ${header}`, { [header]: '203.0.113.9' }, '127.0.0.1', 403]
    ),
    ['a non-loopback caller', {}, '192.168.1.4', 403],
    ['a caller without an address', {}, null, 403],
    ['IPv6 loopback', {}, '::1', 200],
    ['IPv4-mapped loopback', {}, '::ffff:127.0.0.1', 200]
  ] as [string, Record<string, string>, string | null, number][])('will answer %s with %i', async (_, headers, remote, status) => {
    expect((await request('GET', '/', '', headers, remote)).statusCode).toBe(status);
  });
});

describe('relay devtools', () => {
  let env = setup({ token: 't' });

  beforeEach(() => void (env = setup({ token: 't' })));

  it('will send a joined ui the page roster', async () => {
    env.page('a', () => ({ value: { id: 'a' } }));
    const ui = env.ui('t');
    await flushMicrotasks();
    expect(ui.sent).toEqual([{ event: 'expressive-inspect:pages', data: [{ id: 'a' }] }]);
  });

  it('will deny a join without the token', async () => {
    const ui = env.ui('wrong');
    await flushMicrotasks();
    expect(ui.sent).toEqual([{ event: 'expressive-inspect:pages', data: { error: 'Dev token mismatch.' } }]);
  });

  it('will accept a join when no token is configured', async () => {
    env = setup();
    const ui = env.ui();
    await flushMicrotasks();
    expect(ui.sent).toEqual([{ event: 'expressive-inspect:pages', data: [] }]);
  });

  it('will prune a ui whose socket is already gone', async () => {
    const ui = env.ui('t');
    await flushMicrotasks();
    env.clients.delete(ui.client);
    env.page('a', () => ({ value: { id: 'a' } }));
    await flushMicrotasks();
    expect(ui.sent).toHaveLength(1);
  });

  it('will push the roster to joined uis as pages come and go', async () => {
    const ui = env.ui('t');
    const respond = vi.fn(() => ({ value: { id: 'b' } }));
    const client = env.page('b', respond);
    await flushMicrotasks();
    expect(ui.sent.at(-1)).toEqual({ event: 'expressive-inspect:pages', data: [{ id: 'b' }] });

    env.disconnect(client);
    await flushMicrotasks();
    expect(ui.sent.at(-1)).toEqual({ event: 'expressive-inspect:pages', data: [] });
  });

  it('will answer a roster request', async () => {
    env.page('a', () => ({ value: { id: 'a' } }));
    const ui = env.ui('t');
    await ui.forward({ rid: 1 });
    expect(ui.sent.at(-1)).toEqual({ event: 'expressive-inspect:answer', data: { rid: 1, value: [{ id: 'a' }] } });
  });

  it('will forward a call to the addressed page', async () => {
    const respond = vi.fn(() => ({ value: 'typed' }));
    env.page('a');
    env.page('b', respond);
    const ui = env.ui('t');
    await flushMicrotasks();
    respond.mockClear();
    await ui.forward({ rid: 2, target: 'b', call: [['get'], ['Composer.draft']] });
    expect(respond).toHaveBeenCalledWith([['get'], ['Composer.draft']]);
    expect(ui.sent.at(-1)).toEqual({ event: 'expressive-inspect:answer', data: { rid: 2, value: 'typed' } });
  });

  it('will call the only page without a target', async () => {
    env.page('a', () => ({ value: 1 }));
    const ui = env.ui('t');
    await ui.forward({ rid: 3, call: [['get'], []] });
    expect(ui.sent.at(-1)).toEqual({ event: 'expressive-inspect:answer', data: { rid: 3, value: 1 } });
  });

  it.each([
    ['no page by that id', 'zz', 'No page zz.'],
    ['no target and several pages', undefined, 'Several pages connected - pick one.']
  ])('will refuse to guess: %s', async (_, target, error) => {
    env.page('a', () => ({ value: { id: 'a' } }));
    env.page('b', () => ({ value: { id: 'b' } }));
    const ui = env.ui('t');
    await ui.forward({ rid: 4, target, call: [['get'], []] });
    expect(ui.sent.at(-1)).toEqual({ event: 'expressive-inspect:answer', data: { rid: 4, error } });
  });

  it('will report no pages connected', async () => {
    const ui = env.ui('t');
    await ui.forward({ rid: 5, call: [['get'], []] });
    expect(ui.sent.at(-1)).toEqual({ event: 'expressive-inspect:answer', data: { rid: 5, error: 'No pages connected.' } });
  });

  it('will error when the page does not answer', async () => {
    vi.useFakeTimers();
    env.page('a', () => undefined);
    const ui = env.ui('t');
    const done = ui.forward({ rid: 6, target: 'a', call: [['get'], []] });
    await vi.advanceTimersByTimeAsync(CALL_TIMEOUT);
    await done;
    expect(ui.sent.at(-1)).toEqual({ event: 'expressive-inspect:answer', data: { rid: 6, error: 'Page did not answer.' } });
  });

  it('will ignore a forward from a client that never joined', async () => {
    env.page('a', () => ({ value: 1 }));
    const ui = env.ui('wrong');
    await ui.forward({ rid: 7, call: [['get'], []] });
    expect(ui.sent.filter(({ event }) => event === 'expressive-inspect:answer')).toHaveLength(0);
  });
});
