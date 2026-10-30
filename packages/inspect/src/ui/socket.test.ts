// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { flushMicrotasks } from '../../test.setup';
import { connectWs } from './socket';

type Handler = ((event: any) => void) | null;

class FakeSocket {
  static last: FakeSocket;
  static fail = false;

  onopen: Handler = null;
  onerror: Handler = null;
  onmessage: Handler = null;
  onclose: Handler = null;
  sent: any[] = [];

  constructor(readonly url: string, readonly protocol?: string) {
    FakeSocket.last = this;
    queueMicrotask(() => (FakeSocket.fail ? this.onerror!({}) : this.onopen!({})));
  }

  send(data: string) {
    this.sent.push(JSON.parse(data));
  }

  receive(message: unknown) {
    this.onmessage!({ data: JSON.stringify(message) });
  }

  answer(data: unknown) {
    this.receive({ type: 'custom', event: 'expressive-inspect:answer', data });
  }

  pages(data: unknown) {
    this.receive({ type: 'custom', event: 'expressive-inspect:pages', data });
  }

  close() {
    this.onclose!({});
  }
}

vi.stubGlobal('WebSocket', FakeSocket);

afterEach(() => {
  FakeSocket.fail = false;
});

describe('connectWs', () => {
  it('will connect to the hmr socket with the embedded tokens', () => {
    connectWs({ token: 't', ws: 'v', base: '/app/' });
    expect(FakeSocket.last.url).toBe('ws://localhost:3000/app/?token=v');
    expect(FakeSocket.last.protocol).toBe('vite-hmr');
  });

  it('will connect securely under https', async () => {
    vi.stubGlobal('location', { protocol: 'https:', host: 'app.test' });
    connectWs({});
    expect(FakeSocket.last.url.startsWith('wss://app.test/')).toBe(true);
    vi.unstubAllGlobals();
    vi.stubGlobal('WebSocket', FakeSocket);
  });

  it('will join on open', async () => {
    connectWs({ token: 't' });
    await flushMicrotasks();
    expect(FakeSocket.last.sent[0]).toEqual({
      type: 'custom',
      event: 'expressive-inspect:join',
      data: { token: 't' }
    });
  });

  it('will forward calls and resolve answers', async () => {
    const connection = connectWs({});
    const done = connection.send([['get'], ['a']]);

    await flushMicrotasks();
    expect(FakeSocket.last.sent.at(-1)).toEqual({
      type: 'custom',
      event: 'expressive-inspect:forward',
      data: { rid: 1, target: undefined, call: [['get'], ['a']] }
    });

    FakeSocket.last.answer({ rid: 1, value: 42 });
    await expect(done).resolves.toBe(42);
  });

  it('will address a page and ask the roster without a call', async () => {
    const connection = connectWs({});
    const done = connection.send(undefined, 'b');

    await flushMicrotasks();
    expect(FakeSocket.last.sent.at(-1)).toMatchObject({
      event: 'expressive-inspect:forward',
      data: { rid: 1, target: 'b' }
    });

    FakeSocket.last.answer({ rid: 1, value: [{ id: 'b' }] });
    await expect(done).resolves.toEqual([{ id: 'b' }]);
  });

  it('will reject on an answer error', async () => {
    const connection = connectWs({});
    const done = connection.send([['get'], ['a']]);

    await flushMicrotasks();
    FakeSocket.last.answer({ rid: 1, error: 'No model at a.' });
    await expect(done).rejects.toThrow('No model at a.');
  });

  it('will push rosters to watchers', async () => {
    const connection = connectWs({});
    const seen: unknown[] = [];
    connection.watch((pages) => seen.push(pages));

    FakeSocket.last.pages([{ id: 'a' }]);
    FakeSocket.last.pages({ error: 'Denied.' });
    expect(seen).toEqual([[{ id: 'a' }], { error: 'Denied.' }]);
  });

  it('will ignore non-custom messages', async () => {
    const connection = connectWs({});
    connection.send([['get'], ['a']]);
    await flushMicrotasks();

    FakeSocket.last.receive({ type: 'connected' });
    FakeSocket.last.receive({ type: 'custom', event: 'unrelated', data: {} });
    expect(FakeSocket.last.sent).toHaveLength(2);
  });

  it('will settle pending sends when the socket closes', async () => {
    const connection = connectWs({});
    const done = connection.send([['get'], ['a']]);

    await flushMicrotasks();
    connection.close();
    await expect(done).rejects.toThrow('Socket closed.');
  });

  it('will reject sends when the socket fails', async () => {
    FakeSocket.fail = true;
    const connection = connectWs({});
    await expect(connection.send([['get'], ['a']])).rejects.toThrow('Could not reach the dev server socket');
  });
});
