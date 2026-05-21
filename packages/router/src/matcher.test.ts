import { describe, expect, it } from 'vitest';

import { matchPattern } from './matcher';

describe('matchPattern', () => {
  it('matches root', () => {
    expect(matchPattern('/', '/')).toEqual({ params: {} });
  });

  it('matches literal segments', () => {
    expect(matchPattern('/foo/bar', '/foo/bar')).toEqual({ params: {} });
  });

  it('returns null for non-matching literals', () => {
    expect(matchPattern('/foo/bar', '/foo/baz')).toBeNull();
  });

  it('returns null when segment counts differ', () => {
    expect(matchPattern('/foo', '/foo/bar')).toBeNull();
    expect(matchPattern('/foo/bar', '/foo')).toBeNull();
  });

  it('captures :param', () => {
    expect(matchPattern('/posts/:id', '/posts/foo')).toEqual({
      params: { id: 'foo' }
    });
  });

  it('captures multiple :params', () => {
    expect(
      matchPattern('/users/:userId/posts/:postId', '/users/u1/posts/p1')
    ).toEqual({ params: { userId: 'u1', postId: 'p1' } });
  });

  it('normalizes trailing slashes', () => {
    expect(matchPattern('/foo', '/foo/')).toEqual({ params: {} });
    expect(matchPattern('/foo/', '/foo')).toEqual({ params: {} });
    expect(matchPattern('/posts/:id/', '/posts/foo')).toEqual({
      params: { id: 'foo' }
    });
  });

  it('matches case-insensitively on literal segments', () => {
    expect(matchPattern('/Foo/Bar', '/foo/bar')).toEqual({ params: {} });
  });

  it('preserves case in captured params', () => {
    expect(matchPattern('/posts/:id', '/posts/FOO')).toEqual({
      params: { id: 'FOO' }
    });
  });

  it('handles empty path against root pattern', () => {
    expect(matchPattern('/', '')).toEqual({ params: {} });
  });

  it('returns null for no-match with params', () => {
    expect(matchPattern('/posts/:id/edit', '/posts/foo')).toBeNull();
  });
});
