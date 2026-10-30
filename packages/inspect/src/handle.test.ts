import { Model } from '@expressive/mvc';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { attach, inspect, journal } from './index';
import { handle } from './handle';
import { CALL_TIMEOUT } from './protocol';

class Composer extends Model {
  draft = '';

  submit(text: string) {
    this.draft = text;
    return text.length;
  }
}

async function request(method: string, body?: string, headers: Record<string, string> = {}) {
  const res = await handle(new Request('http://localhost/__inspect', { method, body, headers }), { ip: '127.0.0.1' });
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  globalThis.__EXPRESSIVE_INSPECT__ = inspect;
  attach();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  globalThis.__EXPRESSIVE_INSPECT__ = undefined;
});

describe('handle', () => {
  it('will 404 when install never ran', async () => {
    globalThis.__EXPRESSIVE_INSPECT__ = undefined;
    expect(await request('GET')).toEqual({ status: 404, body: { error: 'Inspector not installed.' } });
    expect((await request('POST', '["get"]')).status).toBe(404);
  });

  it('will describe the process', async () => {
    expect(await request('GET')).toEqual({
      status: 200,
      body: {
        process: true,
        pid: process.pid,
        cwd: process.cwd(),
        started: Math.round(performance.timeOrigin),
        runtime: navigator.userAgent,
        title: process.title
      }
    });
  });

  it('will describe a process without node globals', async () => {
    vi.stubGlobal('process', undefined);
    vi.stubGlobal('navigator', undefined);
    expect((await request('GET')).body).toMatchObject({ pid: null, cwd: null, runtime: null, title: null });
  });

  it('will call the inspector', async () => {
    const composer = Composer.new();
    expect(await request('POST', '["call", "Composer.submit", "hi"]')).toEqual({ status: 200, body: 2 });
    expect(composer.draft).toBe('hi');
    expect(await request('POST', '["get", "Composer.draft"]')).toEqual({ status: 200, body: 'hi' });
  });

  it('will split a dotted method into a path', async () => {
    journal.reset();
    expect(await request('POST', '["journal.seq"]')).toEqual({ status: 200, body: 0 });
  });

  it('will answer null for an undefined result', async () => {
    Composer.new();
    expect(await request('POST', '["set", "Composer.draft", "x"]')).toEqual({ status: 200, body: null });
  });

  it('will act on a call and answer its value and frames', async () => {
    Composer.new();
    const { body } = await request('POST', '["act", ["call", "Composer.submit", "hi"]]');
    expect(body).toMatchObject({ value: 2, settled: true, pending: [], missing: [] });
    expect(body.frames[0].events[0]).toMatchObject({ key: 'draft', value: 'hi' });
  });

  it('will 404 an unknown method', async () => {
    expect(await request('POST', '["nope"]')).toEqual({ status: 404, body: { error: 'No inspector method nope.' } });
  });

  it('will 500 when the call throws', async () => {
    expect(await request('POST', '["call", "Missing.method"]')).toEqual({
      status: 500,
      body: { error: 'No method at Missing.method.' }
    });
  });

  it('will 504 when the call does not answer', async () => {
    vi.useFakeTimers();
    globalThis.__EXPRESSIVE_INSPECT__ = { hang: () => new Promise(() => {}) } as never;
    const res = request('POST', '["hang"]');
    await vi.advanceTimersByTimeAsync(CALL_TIMEOUT);
    expect(await res).toEqual({ status: 504, body: { error: 'Call did not answer.' } });
  });

  it('will 400 a body that is not [method, ...args]', async () => {
    expect((await request('POST', 'nope')).status).toBe(400);
  });

  it('will 400 a body already consumed', async () => {
    const req = new Request('http://localhost/', { method: 'POST', body: '["get"]' });
    await req.text();
    expect((await handle(req, { ip: '127.0.0.1' })).status).toBe(400);
  });

  it('will 405 other methods', async () => {
    expect((await request('PUT')).status).toBe(405);
  });

  it.each([
    ['a proxied request', { 'x-forwarded-for': '203.0.113.9' }, '127.0.0.1'],
    ['a non-loopback caller', {}, '192.168.1.4'],
    ['a caller without an address', {}, undefined]
  ])('will 403 %s', async (_, headers, ip) => {
    const res = await handle(new Request('http://localhost/', { headers }), { ip });
    expect(res.status).toBe(403);
  });
});
