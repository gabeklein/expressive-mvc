import { describe, expect, it } from 'vitest';

import { Route, scopeResolves } from './route';

// Pure/lexical opt-out gate: no mounting, no router. Walks JSX props vs a path.

describe('scopeResolves', () => {
  it('matches a leaf at the root', () => {
    const tree = (
      <>
        <Route to="a" />
        <Route to="b" />
      </>
    );
    expect(scopeResolves(tree, '', '/a')).toBe(true);
    expect(scopeResolves(tree, '', '/b')).toBe(true);
    expect(scopeResolves(tree, '', '/c')).toBe(false);
  });

  it('see-through: a group counts iff a descendant leaf matches', () => {
    const tree = (
      <Route to="intro">
        <Route to="basics" />
      </Route>
    );
    expect(scopeResolves(tree, '', '/intro/basics')).toBe(true);
    // strict: no matching descendant -> false (bubbles), NOT a greedy prefix
    expect(scopeResolves(tree, '', '/intro/bogus')).toBe(false);
    // bare prefix with no index leaf also misses
    expect(scopeResolves(tree, '', '/intro')).toBe(false);
  });

  it('an index leaf (no `to`) resolves the group base exactly', () => {
    const tree = (
      <Route to="intro">
        <Route />
        <Route to="basics" />
      </Route>
    );
    expect(scopeResolves(tree, '', '/intro')).toBe(true);
    expect(scopeResolves(tree, '', '/intro/basics')).toBe(true);
    expect(scopeResolves(tree, '', '/intro/bogus')).toBe(false);
  });

  it('an anonymous (no-`to`) wrapper is transparent, adding no segment', () => {
    const tree = (
      <Route>
        <Route to="intro">
          <Route to="basics" />
        </Route>
      </Route>
    );
    expect(scopeResolves(tree, '', '/intro/basics')).toBe(true);
    expect(scopeResolves(tree, '', '/nope')).toBe(false);
  });

  it('captures-bearing leaf still matches', () => {
    const tree = <Route to="posts/:id" />;
    expect(scopeResolves(tree, '', '/posts/42')).toBe(true);
    expect(scopeResolves(tree, '', '/posts')).toBe(false);
  });

  it('skips a redirect child as a match candidate', () => {
    const tree = (
      <>
        <Route to="" redirect="/home" />
        <Route to="a" />
      </>
    );
    expect(scopeResolves(tree, '', '/a')).toBe(true);
    expect(scopeResolves(tree, '', '/anything')).toBe(false);
  });

  it('a default claims anything within the scope base', () => {
    const tree = (
      <Route to="docs">
        <Route to=":id" />
        <Route default />
      </Route>
    );
    expect(scopeResolves(tree, '', '/docs')).toBe(true);
    expect(scopeResolves(tree, '', '/docs/intro')).toBe(true);
    expect(scopeResolves(tree, '', '/docs/a/b')).toBe(true);
    expect(scopeResolves(tree, '', '/elsewhere')).toBe(false);
  });

  it('a nested scope default resolves its ancestors too', () => {
    const tree = (
      <Route to="a">
        <Route to="b">
          <Route to=":id" />
          <Route default />
        </Route>
      </Route>
    );
    expect(scopeResolves(tree, '', '/a/b')).toBe(true);
    expect(scopeResolves(tree, '', '/a/b/x/y')).toBe(true);
    expect(scopeResolves(tree, '', '/a/c')).toBe(false);
  });
});
