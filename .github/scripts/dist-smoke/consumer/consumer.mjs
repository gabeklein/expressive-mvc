import assert from 'node:assert/strict';
import { Window } from 'happy-dom';

const window = new Window({ url: 'http://localhost/' });

for (const key of ['window', 'document', 'navigator', 'location', 'history', 'Node', 'Element', 'HTMLElement', 'SVGElement', 'DocumentFragment', 'CSSStyleSheet', 'getComputedStyle'])
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: key == 'window' ? window : window[key] });

const { mount } = await import('./bundle.js');
const root = document.body.appendChild(document.createElement('div'));
const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

mount(root);
await tick();
assert.equal(root.querySelector('#items').textContent, 'a');

const draft = root.querySelector('#draft');
draft.value = 'b';
draft.dispatchEvent(new window.Event('input', { bubbles: true }));
root.querySelector('#add').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await tick();
assert.equal(root.querySelector('#items').textContent, 'ab');
assert.equal(draft.value, '');

root.querySelector('a').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
await tick(20);
assert.equal(root.querySelector('#other')?.textContent, 'other');

console.log('dom: consumer type-check, bundle and render ok');
