import { State } from '@expressive/mvc';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';

import { attach, inspect as local } from '../index';
import { connect, type Hot } from './client';
import inspect from './index';

const packages = fileURLToPath(new URL('../../../', import.meta.url));

class Composer extends State {
  draft = '';
}

let server: ViteDevServer;
let root: string;
let origin: string;

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'inspect-vite-'));
  writeFileSync(join(root, 'index.html'), '<html><head></head><body><script type="module" src="/main.js"></script></body></html>');

  server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [inspect()],
    server: { port: 0, host: '127.0.0.1' },
    resolve: {
      alias: [{ find: /^@expressive\/([^/]+)\/(.+)$/, replacement: `${packages}$1/src/$2` }]
    }
  });

  await server.listen();
  origin = `http://127.0.0.1:${(server.httpServer!.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await server.close();
  rmSync(root, { recursive: true });
});

async function open() {
  const token = encodeURIComponent(server.config.webSocketToken);
  const socket = new WebSocket(`${origin.replace('http', 'ws')}/?token=${token}`, 'vite-hmr');
  const listeners = new Map<string, (data: any) => unknown>();

  socket.onmessage = ({ data }) => {
    const payload = JSON.parse(data);
    if (payload.type === 'custom') listeners.get(payload.event)?.(payload.data);
  };

  await new Promise((resolve) => (socket.onopen = resolve));

  const hot: Hot = {
    on: (event, listener) => void listeners.set(event, listener),
    send: (event, data) => socket.send(JSON.stringify({ type: 'custom', event, data }))
  };

  return { socket, hot };
}

const post = (path: string, body: unknown) =>
  fetch(origin + path, { method: 'POST', body: JSON.stringify(body) }).then((res) => res.json());

it('will inject the virtual module ahead of the app entry', async () => {
  const html = await fetch(origin + '/').then((res) => res.text());
  expect(html.indexOf('/@id/virtual:expressive-inspect')).toBeGreaterThan(-1);
  expect(html.indexOf('/@id/virtual:expressive-inspect')).toBeLessThan(html.indexOf('/main.js'));

  const res = await fetch(origin + '/@id/virtual:expressive-inspect');
  expect(res.status).toBe(200);
  expect(await res.text()).toMatch(/connect\(import\.meta\.hot\)/);
});

it('will relay calls to a connected page and drop it on close', async () => {
  vi.stubGlobal('window', { self: 1, top: 1 });
  vi.stubGlobal('location', { href: 'http://127.0.0.1/app' });
  vi.stubGlobal('document', { title: 'App' });
  globalThis.__EXPRESSIVE_INSPECT__ = local;
  attach();

  const composer = Composer.new();
  const { socket, hot } = await open();

  connect(hot);

  await vi.waitFor(async () => {
    expect(await fetch(origin + '/__inspect').then((res) => res.json())).toHaveLength(1);
  });

  const [page] = await fetch(origin + '/__inspect').then((res) => res.json());
  expect(page).toEqual({ id: expect.any(String), url: 'http://127.0.0.1/app', title: 'App', top: true });

  expect(await post(`/__inspect/${page.id}`, ['get', 'Composer.draft'])).toBe('');
  await post('/__inspect', ['set', 'Composer.draft', 'typed']);
  expect(composer.draft).toBe('typed');

  const refused = await fetch(origin + '/__inspect', { headers: { origin: 'http://evil.test' } });
  expect(refused.status).toBe(403);

  await new Promise((resolve) => {
    socket.onclose = resolve;
    socket.close();
  });

  await vi.waitFor(
    async () => {
      expect(await fetch(origin + '/__inspect').then((res) => res.json())).toEqual([]);
    },
    { timeout: 5000 }
  );

  vi.unstubAllGlobals();
  globalThis.__EXPRESSIVE_INSPECT__ = undefined;
});
