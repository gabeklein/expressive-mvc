import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import State, { Component, get, set, ref, def, has, map } from '@expressive/react';

for (const [name, value] of Object.entries({ State, Component, get, set, ref, def, has, map }))
  assert.equal(typeof value, 'function', name + ' is not exported by the built dist');

class Counter extends State {
  value = 5;
}

const View = () => createElement('span', null, Counter.use().value);

assert.equal(renderToStaticMarkup(createElement(View)), '<span>5</span>');

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

const { default: reactHot } = await import('@expressive/react/vite');

assert.equal(reactHot().name, '@expressive/react:hot');

console.log('react: hook render + Component render + vite ok');
