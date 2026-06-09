import { describe, expect, it } from 'bun:test';

import { matchesAnywhere, Route } from './route';

// Pure/lexical opt-out gate: no mounting, no router. Walks JSX props vs a path.

describe('matchesAnywhere', () => {
  it('matches a leaf at the root', () => {
    const tree = (
      <>
        <Route to="a" />
        <Route to="b" />
      </>
    );
    expect(matchesAnywhere(tree, '', '/a')).toBe(true);
    expect(matchesAnywhere(tree, '', '/b')).toBe(true);
    expect(matchesAnywhere(tree, '', '/c')).toBe(false);
  });

  it('see-through: a group counts iff a descendant leaf matches', () => {
    const tree = (
      <Route to="intro">
        <Route to="basics" />
      </Route>
    );
    expect(matchesAnywhere(tree, '', '/intro/basics')).toBe(true);
    // strict: no matching descendant -> false (bubbles), NOT a greedy prefix
    expect(matchesAnywhere(tree, '', '/intro/bogus')).toBe(false);
    // bare prefix with no index leaf also misses
    expect(matchesAnywhere(tree, '', '/intro')).toBe(false);
  });

  it('an index leaf (no `to`) resolves the group base exactly', () => {
    const tree = (
      <Route to="intro">
        <Route />
        <Route to="basics" />
      </Route>
    );
    expect(matchesAnywhere(tree, '', '/intro')).toBe(true);
    expect(matchesAnywhere(tree, '', '/intro/basics')).toBe(true);
    expect(matchesAnywhere(tree, '', '/intro/bogus')).toBe(false);
  });

  it('an anonymous (no-`to`) wrapper is transparent, adding no segment', () => {
    const tree = (
      <Route>
        <Route to="intro">
          <Route to="basics" />
        </Route>
      </Route>
    );
    expect(matchesAnywhere(tree, '', '/intro/basics')).toBe(true);
    expect(matchesAnywhere(tree, '', '/nope')).toBe(false);
  });

  it('captures-bearing leaf still matches', () => {
    const tree = <Route to="posts/:id" />;
    expect(matchesAnywhere(tree, '', '/posts/42')).toBe(true);
    expect(matchesAnywhere(tree, '', '/posts')).toBe(false);
  });

  it('skips redirect and fallback children as match candidates', () => {
    const tree = (
      <>
        <Route to="" redirect="/home" />
        <Route fallback />
        <Route to="a" />
      </>
    );
    expect(matchesAnywhere(tree, '', '/a')).toBe(true);
    expect(matchesAnywhere(tree, '', '/anything')).toBe(false);
  });
});
