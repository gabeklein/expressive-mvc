import { describe, expect, it } from 'vitest';

import {
  canonicalize,
  fillPath,
  fullPattern,
  matchPattern,
  normalize,
  patternSegment
} from './url';

const match = (pattern: string, path: string) => matchPattern(pattern, path)?.params;

describe('matchPattern', () => {
  it('will match root', () => {
    expect(match('/', '/')).toEqual({});
  });

  it('will match literal segments', () => {
    expect(match('/foo/bar', '/foo/bar')).toEqual({});
  });

  it('will not match differing literal', () => {
    expect(match('/foo/bar', '/foo/baz')).toBeUndefined();
  });

  it('will not match differing segment counts', () => {
    expect(match('/foo', '/foo/bar')).toBeUndefined();
    expect(match('/foo/bar', '/foo')).toBeUndefined();
  });

  it('will capture :param', () => {
    expect(match('/posts/:id', '/posts/foo')).toEqual({ id: 'foo' });
  });

  it('will capture multiple :params', () => {
    expect(match('/users/:userId/posts/:postId', '/users/u1/posts/p1')).toEqual({
      userId: 'u1',
      postId: 'p1'
    });
  });

  it('will ignore trailing slashes', () => {
    expect(match('/foo', '/foo/')).toEqual({});
    expect(match('/foo/', '/foo')).toEqual({});
    expect(match('/posts/:id/', '/posts/foo')).toEqual({ id: 'foo' });
  });

  it('will match literals case-insensitively', () => {
    expect(match('/Foo/Bar', '/foo/bar')).toEqual({});
  });

  it('will preserve case in params', () => {
    expect(match('/posts/:id', '/posts/FOO')).toEqual({ id: 'FOO' });
  });

  it('will match empty path against root', () => {
    expect(match('/', '')).toEqual({});
  });

  it('will not match missing segment after param', () => {
    expect(match('/posts/:id/edit', '/posts/foo')).toBeUndefined();
  });

  describe('catch-all *', () => {
    it('will capture empty * at root', () => {
      expect(match('*', '/')).toEqual({ '*': '' });
    });

    it('will capture single-segment *', () => {
      expect(match('*', '/foo')).toEqual({ '*': 'foo' });
    });

    it('will capture multi-segment *', () => {
      expect(match('*', '/foo/bar/baz')).toEqual({ '*': 'foo/bar/baz' });
    });

    it('will capture empty * at exact prefix', () => {
      expect(match('/blog/*', '/blog')).toEqual({ '*': '' });
    });

    it('will capture * after prefix', () => {
      expect(match('/blog/*', '/blog/hello-world')).toEqual({
        '*': 'hello-world'
      });
      expect(match('/blog/*', '/blog/a/b/c')).toEqual({ '*': 'a/b/c' });
    });

    it('will not match * with wrong prefix', () => {
      expect(match('/blog/*', '/posts/foo')).toBeUndefined();
    });

    it('will capture * beside :param', () => {
      expect(match('/users/:id/*', '/users/alice/posts/42')).toEqual({
        id: 'alice',
        '*': 'posts/42'
      });
    });
  });
});

describe('fullPattern', () => {
  it('will keep absolute `to`', () => {
    expect(fullPattern('/blog', '/posts/:id')).toBe('/posts/:id');
  });

  it('will return base for empty `to`', () => {
    expect(fullPattern('/blog', '')).toBe('/blog');
  });

  it('will join base and relative `to`', () => {
    expect(fullPattern('/blog', ':slug')).toBe('/blog/:slug');
    expect(fullPattern('', 'foo')).toBe('/foo');
  });

  it('will return empty for empty base and `to`', () => {
    expect(fullPattern('', '')).toBe('');
  });
});

describe('patternSegment', () => {
  it('will return empty for empty `to`', () => {
    expect(patternSegment('')).toBe('');
  });

  it('will return empty for bare catch-all', () => {
    expect(patternSegment('*')).toBe('');
  });

  it('will strip trailing `/*`', () => {
    expect(patternSegment('/blog/*')).toBe('/blog');
  });

  it('will strip trailing `*` without slash', () => {
    expect(patternSegment('/blog*')).toBe('/blog');
  });

  it('will prefix `/` on relative input', () => {
    expect(patternSegment(':slug')).toBe('/:slug');
    expect(patternSegment('blog/*')).toBe('/blog');
  });

  it('will keep literal pattern', () => {
    expect(patternSegment('/posts/:id')).toBe('/posts/:id');
  });
});

describe('fillPath', () => {
  it('will claim prefix with params filled', () => {
    expect(fillPath('/users/:id', '/users/42/posts')).toBe('/users/42');
  });

  it('will return null on disagreeing literal', () => {
    expect(fillPath('/users/:id', '/posts/42')).toBe(null);
  });
});

describe('URL normalization', () => {
  it('will canonicalize search without consuming the fragment', () => {
    expect(canonicalize('/docs?q=a%20b&q=last#install')).toBe(
      '/docs?q=last#install'
    );
    expect(canonicalize('/docs#install')).toBe('/docs#install');
  });

  it('will normalize path, search, and fragment together', () => {
    expect(normalize('/guides/../docs?q=a%20b#hello world')).toBe(
      '/docs?q=a+b#hello%20world'
    );
  });
});
