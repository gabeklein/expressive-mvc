import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as react from '@expressive/react';
import { Model, Component, get, set, ref, def, has, map } from '@expressive/mvc';

assert.deepEqual(Object.keys(react), [], 'the react dist re-exports something');

for (const [name, value] of Object.entries({ Model, Component, get, set, ref, def, has, map }))
  assert.equal(typeof value, 'function', name + ' is not exported by the core dist');

class Counter extends Model {
  value = 5;
}

const View = () => createElement('span', null, Counter.get().value);

assert.equal(
  renderToStaticMarkup(createElement(Component, { for: Counter }, createElement(View))),
  '<span>5</span>'
);

class Widget extends Component {
  label = 'unset';

  render() {
    return createElement('b', null, this.label);
  }
}

assert.equal(
  renderToStaticMarkup(createElement(Widget, { label: 'patched' })),
  '<b>patched</b>'
);

// Collections render as elements through the core's renderable seam - which
// a shaken bundle must keep, since the adapter imports neither `has` nor `map`.
class Rows extends Component {
  items = has(['a', 'b']);
  entries = map([['k', 'v']]);

  render() {
    return createElement('ul', null, this.items, this.entries);
  }
}

assert.equal(renderToStaticMarkup(createElement(Rows)), '<ul>abv</ul>');

const { default: reactHot } = await import('@expressive/react/vite');

assert.equal(reactHot().name, '@expressive/react:hot');

console.log('react: hook render + Component render + collections + vite ok');
