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
  it.each([
    ['will match first root leaf', leaves, '/a', true],
    ['will match second root leaf', leaves, '/b', true],
    ['will not match unknown root leaf', leaves, '/c', false],
    ['will see through a group to a matching leaf', group, '/intro/basics', true],
    ['will not greedily match a group prefix', group, '/intro/bogus', false],
    ['will not match a group base without index', group, '/intro', false],
    ['will match group base by index leaf', indexed, '/intro', true],
    ['will match sibling of index leaf', indexed, '/intro/basics', true],
    ['will not match unknown beside index leaf', indexed, '/intro/bogus', false],
    ['will treat anonymous wrapper as transparent', wrapped, '/intro/basics', true],
    ['will not match outside anonymous wrapper', wrapped, '/nope', false],
    ['will match a param leaf', param, '/posts/42', true],
    ['will not match param leaf without param', param, '/posts', false],
    ['will match leaf beside a redirect', redirecting, '/a', true],
    ['will not treat redirect as a candidate', redirecting, '/anything', false],
    ['will claim scope base with none', none, '/docs', true],
    ['will claim scope child with none', none, '/docs/intro', true],
    ['will claim deep scope path with none', none, '/docs/a/b', true],
    ['will not claim outside scope with none', none, '/elsewhere', false],
    ['will resolve ancestors for nested none at base', nestedNone, '/a/b', true],
    ['will resolve ancestors for nested none deep', nestedNone, '/a/b/x/y', true],
    ['will not resolve sibling of nested none scope', nestedNone, '/a/c', false]
  ])('%s', (_, tree, path, expected) => {
    expect(scopeResolves(tree, '', path)).toBe(expected);
  });
});
