import assert from 'node:assert/strict';
import State, { Component } from '@expressive/mvc';
import { Consumer, Provider, createPortal, lazy, macro, render, style } from '@expressive/dom';
import { jsx, jsxs } from '@expressive/dom/jsx-runtime';
import { jsxDEV } from '@expressive/dom/jsx-dev-runtime';

for (const [name, value] of Object.entries({ State, Component, Consumer, Provider, createPortal, lazy, macro, render, style, jsx, jsxs, jsxDEV }))
  assert.equal(typeof value, 'function', name + ' is not exported by the built dist');

assert.equal(jsx('div', { children: 'ready' }).type, 'div');

console.log('dom: import shape ok');
