import assert from 'node:assert/strict';
import State, { Component } from '@expressive/mvc';
import { Fragment, Portal, createElement, lazy, macro, render, style } from '@expressive/dom';
import { jsx, jsxs } from '@expressive/dom/jsx-runtime';
import { jsxDEV } from '@expressive/dom/jsx-dev-runtime';

for (const [name, value] of Object.entries({ State, Component, createElement, lazy, macro, render, style, jsx, jsxs, jsxDEV }))
  assert.equal(typeof value, 'function', name + ' is not exported by the built dist');

assert.equal(typeof Portal, 'symbol', 'Portal is not exported by the built dist');
assert.equal(typeof Fragment, 'symbol', 'Fragment is not exported by the built dist');
assert.equal(createElement('p', { key: 'k' }, 'x').props.children, 'x');

assert.equal(jsx('div', { children: 'ready' }).type, 'div');

const { default: domHot } = await import('@expressive/dom/vite');

assert.equal(domHot().name, '@expressive/dom:hot');

console.log('dom: import shape + vite ok');
