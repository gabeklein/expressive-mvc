import { describe, expect, it } from 'vitest';

import {
  canonicalize,
  fillPath,
  fullPattern,
  matchPattern,
  normalize,
  patternSegment
} from './url';

describe('matchPattern', () => {
  it.each([
    ['will match root', '/', '/', {}],
    ['will match empty path against root', '/', '', {}],
    ['will match literal segments', '/foo/bar', '/foo/bar', {}],
    ['will not match differing literal', '/foo/bar', '/foo/baz', undefined],
    ['will not match longer path', '/foo', '/foo/bar', undefined],
    ['will not match shorter path', '/foo/bar', '/foo', undefined],
    ['will not match missing segment after param', '/posts/:id/edit', '/posts/foo', undefined],
    ['will capture :param', '/posts/:id', '/posts/foo', { id: 'foo' }],
    ['will capture multiple :params', '/users/:userId/posts/:postId', '/users/u1/posts/p1', { userId: 'u1', postId: 'p1' }],
    ['will ignore trailing slash on path', '/foo', '/foo/', {}],
    ['will ignore trailing slash on pattern', '/foo/', '/foo', {}],
    ['will ignore trailing slash after param', '/posts/:id/', '/posts/foo', { id: 'foo' }],
    ['will match literals case-insensitively', '/Foo/Bar', '/foo/bar', {}],
    ['will preserve case in params', '/posts/:id', '/posts/FOO', { id: 'FOO' }],
    ['will capture empty * at root', '*', '/', { '*': '' }],
    ['will capture single-segment *', '*', '/foo', { '*': 'foo' }],
    ['will capture multi-segment *', '*', '/foo/bar/baz', { '*': 'foo/bar/baz' }],
    ['will capture empty * at exact prefix', '/blog/*', '/blog', { '*': '' }],
    ['will capture * after prefix', '/blog/*', '/blog/hello-world', { '*': 'hello-world' }],
    ['will capture deep * after prefix', '/blog/*', '/blog/a/b/c', { '*': 'a/b/c' }],
    ['will not match * with wrong prefix', '/blog/*', '/posts/foo', undefined],
    ['will capture * beside :param', '/users/:id/*', '/users/alice/posts/42', { id: 'alice', '*': 'posts/42' }]
  ])('%s', (_, pattern, path, params) => {
    expect(matchPattern(pattern, path)?.params).toEqual(params);
  });
});

describe('fullPattern', () => {
  it.each([
    ['will keep absolute `to`', '/blog', '/posts/:id', '/posts/:id'],
    ['will return base for empty `to`', '/blog', '', '/blog'],
    ['will join base and relative `to`', '/blog', ':slug', '/blog/:slug'],
    ['will root relative `to` on empty base', '', 'foo', '/foo'],
    ['will return empty for empty base and `to`', '', '', '']
  ])('%s', (_, base, to, out) => {
    expect(fullPattern(base, to)).toBe(out);
  });
});

describe('patternSegment', () => {
  it.each([
    ['will return empty for empty `to`', '', ''],
    ['will return empty for bare catch-all', '*', ''],
    ['will strip trailing `/*`', '/blog/*', '/blog'],
    ['will strip trailing `*` without slash', '/blog*', '/blog'],
    ['will prefix `/` on relative param', ':slug', '/:slug'],
    ['will prefix `/` on relative catch-all', 'blog/*', '/blog'],
    ['will keep literal pattern', '/posts/:id', '/posts/:id']
  ])('%s', (_, to, out) => {
    expect(patternSegment(to)).toBe(out);
  });
});

describe('fillPath', () => {
  it.each([
    ['will claim prefix with params filled', '/users/:id', '/users/42/posts', '/users/42'],
    ['will return null on disagreeing literal', '/users/:id', '/posts/42', null]
  ])('%s', (_, pattern, path, out) => {
    expect(fillPath(pattern, path)).toBe(out);
  });
});

describe('URL normalization', () => {
  it.each([
    ['will canonicalize search, keeping fragment', canonicalize, '/docs?q=a%20b&q=last#install', '/docs?q=last#install'],
    ['will canonicalize fragment-only url', canonicalize, '/docs#install', '/docs#install'],
    ['will normalize path, search, and fragment', normalize, '/guides/../docs?q=a%20b#hello world', '/docs?q=a+b#hello%20world']
  ])('%s', (_, fn, url, out) => {
    expect(fn(url)).toBe(out);
  });
});
