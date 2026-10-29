import { Model } from '@expressive/mvc';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { attach, inspect, journal } from './index';
import { handler } from './handler';

class Composer extends Model {
  draft = '';

  submit(text: string) {
    this.draft = text;
    return text.length;
  }
}

async function request(method: string, body?: string, headers: Record<string, string> = {}, ip: string | null | undefined = '127.0.0.1') {
  const res = await handler(new Request('http://localhost/__inspect', { method, body, headers }), { ip });
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  globalThis.__EXPRESSIVE_INSPECT__ = inspect;
  attach();
});

afterEach(() => {
  vi.unstubAllGlobals();
  globalThis.__EXPRESSIVE_INSPECT__ = undefined;
});

describe('handler', () => {
  it('will 404 when install never ran', async () => {
    globalThis.__EXPRESSIVE_INSPECT__ = undefined;
    expect(await request('GET')).toEqual({ status: 404, body: { error: 'Inspector not installed.' } });
    expect((await request('POST', '["get"]')).status).toBe(404);
  });

  it('will describe the process', async () => {
    expect(await request('GET')).toEqual({
      status: 200,
      body: { process: true, pid: process.pid, runtime: 'node', title: process.title }
    });
  });

  it.each([
    ['bun', { Bun: {} }, { pid: process.pid }],
    ['deno', { Deno: { pid: 7 }, process: undefined }, { pid: 7, title: null }],
    ['unknown', { process: undefined }, { pid: null, title: null }]
  ])('will name the %s runtime', async (runtime, globals, expected) => {
    for (const [key, value] of Object.entries(globals)) vi.stubGlobal(key, value);
    expect((await request('GET')).body).toMatchObject({ process: true, runtime, ...expected });
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

  it('will 400 a body that is not [method, ...args]', async () => {
    for (const body of ['', 'nope', '"get"', '{}', '[1]']) expect((await request('POST', body)).status).toBe(400);
  });

  it('will 403 when the server reports no address', async () => {
    expect((await handler(new Request('http://localhost/'), { ip: undefined })).status).toBe(403);
  });

  it('will 405 other methods', async () => {
    expect((await request('PUT')).status).toBe(405);
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
  ] as [string, Record<string, string>, string | null, number][])('will answer %s with %i', async (_, headers, ip, status) => {
    expect((await request('GET', undefined, headers, ip)).status).toBe(status);
  });
});
