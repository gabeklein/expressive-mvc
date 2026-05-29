import { describe, expect, it } from 'bun:test';

import { fullPattern, matchPattern, patternSegment } from './url';

const match = (pattern: string, path: string) => matchPattern(pattern, path)?.params;
const score = (pattern: string, path: string) => matchPattern(pattern, path)!.score;

describe('matchPattern', () => {
  it('matches root', () => {
    expect(match('/', '/')).toEqual({});
  });

  it('matches literal segments', () => {
    expect(match('/foo/bar', '/foo/bar')).toEqual({});
  });

  it('returns null for non-matching literals', () => {
    expect(match('/foo/bar', '/foo/baz')).toBeUndefined();
  });

  it('returns null when segment counts differ', () => {
    expect(match('/foo', '/foo/bar')).toBeUndefined();
    expect(match('/foo/bar', '/foo')).toBeUndefined();
  });

  it('captures :param', () => {
    expect(match('/posts/:id', '/posts/foo')).toEqual({ id: 'foo' });
  });

  it('captures multiple :params', () => {
    expect(match('/users/:userId/posts/:postId', '/users/u1/posts/p1')).toEqual({
      userId: 'u1',
      postId: 'p1'
    });
  });

  it('normalizes trailing slashes', () => {
    expect(match('/foo', '/foo/')).toEqual({});
    expect(match('/foo/', '/foo')).toEqual({});
    expect(match('/posts/:id/', '/posts/foo')).toEqual({ id: 'foo' });
  });

  it('matches case-insensitively on literal segments', () => {
    expect(match('/Foo/Bar', '/foo/bar')).toEqual({});
  });

  it('preserves case in captured params', () => {
    expect(match('/posts/:id', '/posts/FOO')).toEqual({ id: 'FOO' });
  });

  it('handles empty path against root pattern', () => {
    expect(match('/', '')).toEqual({});
  });

  it('returns null for no-match with params', () => {
    expect(match('/posts/:id/edit', '/posts/foo')).toBeUndefined();
  });

  describe('catch-all *', () => {
    it('matches any path with empty capture at root', () => {
      expect(match('*', '/')).toEqual({ '*': '' });
    });

    it('captures a single-segment remainder', () => {
      expect(match('*', '/foo')).toEqual({ '*': 'foo' });
    });

    it('captures multi-segment remainder', () => {
      expect(match('*', '/foo/bar/baz')).toEqual({ '*': 'foo/bar/baz' });
    });

    it('matches a prefixed pattern exactly (empty capture)', () => {
      expect(match('/blog/*', '/blog')).toEqual({ '*': '' });
    });

    it('matches a prefixed pattern with remainder', () => {
      expect(match('/blog/*', '/blog/hello-world')).toEqual({
        '*': 'hello-world'
      });
      expect(match('/blog/*', '/blog/a/b/c')).toEqual({ '*': 'a/b/c' });
    });

    it('returns null when prefix does not match', () => {
      expect(match('/blog/*', '/posts/foo')).toBeUndefined();
    });

    it('coexists with :param captures', () => {
      expect(match('/users/:id/*', '/users/alice/posts/42')).toEqual({
        id: 'alice',
        '*': 'posts/42'
      });
    });
  });
});

describe('fullPattern', () => {
  it('returns `to` unchanged when absolute', () => {
    expect(fullPattern('/blog', '/posts/:id')).toBe('/posts/:id');
  });

  it('returns base when `to` is empty', () => {
    expect(fullPattern('/blog', '')).toBe('/blog');
  });

  it('joins base and relative `to` with `/`', () => {
    expect(fullPattern('/blog', ':slug')).toBe('/blog/:slug');
    expect(fullPattern('', 'foo')).toBe('/foo');
  });

  it('empty base + empty `to` is empty (matches root only)', () => {
    expect(fullPattern('', '')).toBe('');
  });
});

describe('patternSegment', () => {
  it('returns empty for empty `to`', () => {
    expect(patternSegment('')).toBe('');
  });

  it('returns empty for bare catch-all', () => {
    expect(patternSegment('*')).toBe('');
  });

  it('strips trailing `/*`', () => {
    expect(patternSegment('/blog/*')).toBe('/blog');
  });

  it('strips trailing `*` without slash', () => {
    expect(patternSegment('/blog*')).toBe('/blog');
  });

  it('prefixes leading `/` for relative input', () => {
    expect(patternSegment(':slug')).toBe('/:slug');
    expect(patternSegment('blog/*')).toBe('/blog');
  });

  it('preserves literal patterns unchanged', () => {
    expect(patternSegment('/posts/:id')).toBe('/posts/:id');
  });
});

describe('match score (specificity)', () => {
  it('ranks more literal segments higher', () => {
    expect(score('/posts/new', '/posts/new')).toBeGreaterThan(
      score('/posts/:id', '/posts/new')
    );
  });

  it('ranks :param higher than catch-all', () => {
    expect(score('/posts/:id', '/posts/foo')).toBeGreaterThan(
      score('/posts/*', '/posts/foo')
    );
  });

  it('ranks empty pattern (exact root) higher than catch-all', () => {
    expect(score('', '')).toBeGreaterThan(score('*', ''));
  });

  it('catch-all alone is the least specific', () => {
    expect(score('*', '/foo')).toBeLessThan(score('/foo', '/foo'));
    expect(score('*', '/id')).toBeLessThan(score(':id', '/id'));
  });

  it('longer pattern with literals beats shorter pattern', () => {
    expect(score('/posts/:id/edit', '/posts/x/edit')).toBeGreaterThan(
      score('/posts/:id', '/posts/x')
    );
  });
});
