import { expect, it } from 'vitest';
import { render } from './index';
import { vnode } from './vnode';

it('B3 lowercase contenteditable runtime', () => {
  const root = document.createElement('main');
  render(vnode('div', { contenteditable: false }), root);
  expect(root.querySelector('div')!.getAttribute('contenteditable')).toBe('false');
});
