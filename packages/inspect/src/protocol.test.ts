import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { attach, inspect } from './index';
import { answer, local, parse } from './protocol';

describe('local', () => {
  it.each(['127.0.0.1', '127.0.0.2', '::1', '::ffff:127.0.0.1'])('will accept loopback %s', (ip) => {
    expect(local(ip, new Set())).toBe(true);
  });

  it.each([
    '192.168.1.4',
    '::ffff:192.168.1.4',
    '[::1]',
    'localhost',
    '127.0.0.1, 203.0.113.9',
    '1127.0.0.1',
    '',
    null,
    undefined
  ])('will refuse %s', (ip) => {
    expect(local(ip, new Set())).toBe(false);
  });

  it.each(['origin', 'sec-fetch-site', 'forwarded', 'x-forwarded-for', 'x-real-ip', 'cf-connecting-ip'])(
    'will refuse a request carrying %s',
    (header) => {
      expect(local('127.0.0.1', new Set(['accept', header]))).toBe(false);
    }
  );
});

describe('parse', () => {
  it('will split a dotted method into a path', () => {
    expect(parse('["journal.frames", { "since": 3 }]')).toEqual([['journal', 'frames'], [{ since: 3 }]]);
    expect(parse('["get"]')).toEqual([['get'], []]);
  });

  it.each(['', 'nope', '"get"', '{}', '[]', '[1]'])('will refuse %j', (text) => {
    expect(parse(text)).toBeUndefined();
  });
});

describe('answer', () => {
  beforeEach(() => {
    globalThis.__EXPRESSIVE_INSPECT__ = inspect;
    attach();
  });

  afterEach(() => {
    globalThis.__EXPRESSIVE_INSPECT__ = undefined;
  });

  it('will answer 404 for an unknown method', async () => {
    expect(await answer([['nope'], []])).toEqual({ error: 'No inspector method nope.', status: 404 });
  });

  it('will not take a status from the error a call throws', async () => {
    globalThis.__EXPRESSIVE_INSPECT__ = {
      fail() {
        throw Object.assign(new Error('Unauthorized'), { status: 401 });
      }
    } as never;

    expect(await answer([['fail'], []])).toEqual({ error: 'Unauthorized', status: undefined });
  });
});
