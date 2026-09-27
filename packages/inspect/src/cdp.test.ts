import { State } from '@expressive/mvc';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { inspect } from './bridge';
import { cdp, type Target } from './cdp';
import { dispatch } from './dispatch';
import { attach, inspect as local } from './index';

class Composer extends State {
  draft = '';
}

type Handler = ((event: any) => void) | null;

class FakeSocket {
  static last: FakeSocket;
  static fail = false;

  onopen: Handler = null;
  onerror: Handler = null;
  onmessage: Handler = null;
  onclose: Handler = null;
  sent: any[] = [];
  reply: (message: any) => unknown = (message) => ({ id: message.id, result: { result: { value: 'ok' } } });

  constructor(readonly url: string) {
    FakeSocket.last = this;
    queueMicrotask(() => (FakeSocket.fail ? this.onerror!({}) : this.onopen!({})));
  }

  send(data: string) {
    const message = JSON.parse(data);
    this.sent.push(message);
    Promise.resolve(this.reply(message)).then((reply) => reply && this.onmessage!({ data: JSON.stringify(reply) }));
  }

  close() {
    this.onclose!({});
  }
}

const targets: Target[] = [
  { type: 'node', title: 'no socket', url: 'file:///a.js' },
  { type: 'page', title: 'Other', url: 'http://other/', webSocketDebuggerUrl: 'ws://127.0.0.1:9229/other' },
  { type: 'page', title: 'App', url: 'http://localhost:5173/', webSocketDebuggerUrl: 'ws://127.0.0.1:9229/app' }
];

beforeEach(() => {
  FakeSocket.fail = false;
  vi.stubGlobal('WebSocket', FakeSocket);
  vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => targets })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  globalThis.__EXPRESSIVE_INSPECT__ = undefined;
});

describe('cdp', () => {
  it('will connect to the first target with a debugger url', async () => {
    await cdp();
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:9229/json/list');
    expect(FakeSocket.last.url).toBe('ws://127.0.0.1:9229/other');
  });

  it('will connect to the first target picked', async () => {
    await cdp('http://127.0.0.1:9222', (target) => target.url.includes('localhost'));
    expect(FakeSocket.last.url).toBe('ws://127.0.0.1:9229/app');
  });

  it('will connect to a debugger url directly', async () => {
    await cdp('ws://127.0.0.1:9229/direct');
    expect(fetch).not.toHaveBeenCalled();
    expect(FakeSocket.last.url).toBe('ws://127.0.0.1:9229/direct');
  });

  it('will throw if no target matches', async () => {
    await expect(cdp(undefined, () => false)).rejects.toThrow('No debug target at http://127.0.0.1:9229.');
  });

  it('will throw if the socket does not open', async () => {
    FakeSocket.fail = true;
    await expect(cdp('ws://x')).rejects.toThrow('Could not connect to ws://x.');
  });

  it('will evaluate a function with its argument by value', async () => {
    const target = await cdp('ws://x');
    expect(await target.evaluate((n: number) => n + 1, 1)).toBe('ok');
    expect(FakeSocket.last.sent[0]).toEqual({
      id: 1,
      method: 'Runtime.evaluate',
      params: { expression: '((n) => n + 1)(1)', awaitPromise: true, returnByValue: true }
    });
  });

  it('will throw what the evaluated function threw', async () => {
    const target = await cdp('ws://x');
    FakeSocket.last.reply = ({ id }) => ({ id, result: { result: {}, exceptionDetails: { text: 'Uncaught', exception: { description: 'Error: boom' } } } });
    await expect(target.evaluate(() => 0)).rejects.toThrow('Error: boom');
    FakeSocket.last.reply = ({ id }) => ({ id, result: { result: {}, exceptionDetails: { text: 'Uncaught' } } });
    await expect(target.evaluate(() => 0)).rejects.toThrow('Uncaught');
  });

  it('will throw a protocol error', async () => {
    const target = await cdp('ws://x');
    FakeSocket.last.reply = ({ id }) => ({ id, error: { message: 'Method not found' } });
    await expect(target.evaluate(() => 0)).rejects.toThrow('Method not found');
  });

  it('will fail pending calls when closed', async () => {
    const target = await cdp('ws://x');
    FakeSocket.last.reply = () => undefined;
    const pending = target.evaluate(() => 0);
    target.close();
    await expect(pending).rejects.toThrow('Debug connection closed.');
  });

  it('will drive the bridge', async () => {
    globalThis.__EXPRESSIVE_INSPECT__ = local;
    attach();
    Composer.new();
    const api = inspect(await cdp('ws://x'));
    FakeSocket.last.reply = async ({ id, params }) => {
      const { expression } = params as { expression: string };
      const call = JSON.parse(expression.slice(expression.lastIndexOf(')([') + 2, -1));
      return { id, result: { result: { value: await dispatch(call) } } };
    };
    await api.set('Composer.draft', 'remote');
    expect(await api.get('Composer.draft')).toBe('remote');
  });
});
