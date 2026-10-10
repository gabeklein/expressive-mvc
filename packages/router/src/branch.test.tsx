import { describe, expect, it } from 'vitest';

import { Route, scopeResolves } from './route';

const leaves = (
  <>
    <Route to="a" />
    <Route to="b" />
  </>
);

const group = (
  <Route to="intro">
    <Route to="basics" />
  </Route>
);

const indexed = (
  <Route to="intro">
    <Route />
    <Route to="basics" />
  </Route>
);

const wrapped = (
  <Route>
    <Route to="intro">
      <Route to="basics" />
    </Route>
  </Route>
);

const param = <Route to="posts/:id" />;

const redirecting = (
  <>
    <Route to="" redirect="/home" />
    <Route to="a" />
  </>
);

const none = (
  <Route to="docs">
    <Route to=":id" />
    <Route none />
  </Route>
);

const nestedNone = (
  <Route to="a">
    <Route to="b">
      <Route to=":id" />
      <Route none />
    </Route>
  </Route>
);

describe('scopeResolves', () => {
  it('will match a leaf at the root', () => {
    expect(scopeResolves(leaves, '', '/a')).toBe(true);
    expect(scopeResolves(leaves, '', '/b')).toBe(true);
    expect(scopeResolves(leaves, '', '/c')).toBe(false);
  });

  it('will see through a group only when a descendant leaf matches', () => {
    expect(scopeResolves(group, '', '/intro/basics')).toBe(true);
    expect(scopeResolves(group, '', '/intro/bogus')).toBe(false);
    expect(scopeResolves(group, '', '/intro')).toBe(false);
  });

  it('will resolve the group base exactly by an index leaf', () => {
    expect(scopeResolves(indexed, '', '/intro')).toBe(true);
    expect(scopeResolves(indexed, '', '/intro/basics')).toBe(true);
    expect(scopeResolves(indexed, '', '/intro/bogus')).toBe(false);
  });

  it('will treat an anonymous wrapper as transparent', () => {
    expect(scopeResolves(wrapped, '', '/intro/basics')).toBe(true);
    expect(scopeResolves(wrapped, '', '/nope')).toBe(false);
  });

  it('will match a param leaf', () => {
    expect(scopeResolves(param, '', '/posts/42')).toBe(true);
    expect(scopeResolves(param, '', '/posts')).toBe(false);
  });

  it('will not treat a redirect child as a candidate', () => {
    expect(scopeResolves(redirecting, '', '/a')).toBe(true);
    expect(scopeResolves(redirecting, '', '/anything')).toBe(false);
  });

  it('will claim anything within the scope base with none', () => {
    expect(scopeResolves(none, '', '/docs')).toBe(true);
    expect(scopeResolves(none, '', '/docs/intro')).toBe(true);
    expect(scopeResolves(none, '', '/docs/a/b')).toBe(true);
    expect(scopeResolves(none, '', '/elsewhere')).toBe(false);
  });

  it('will resolve ancestors for a nested scope none', () => {
    expect(scopeResolves(nestedNone, '', '/a/b')).toBe(true);
    expect(scopeResolves(nestedNone, '', '/a/b/x/y')).toBe(true);
    expect(scopeResolves(nestedNone, '', '/a/c')).toBe(false);
  });
});
