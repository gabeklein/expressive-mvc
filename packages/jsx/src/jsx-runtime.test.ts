import { describe, expect, it } from 'vitest';
import {
  childrenOf,
  Fragment,
  isElement,
  jsx as coreJsx,
  jsxDEV as coreJsxDEV,
  jsxs as coreJsxs,
  propsOf,
  typeOf
} from '@expressive/mvc/runtime';

import './jsx-runtime';
import { jsxDEV } from './jsx-dev-runtime';
import { isVNode } from './vnode';

describe('JSX runtime', () => {
  it('will register DOM element mechanics', () => {
    const child = coreJsx('span', { children: 'one' });
    const node = coreJsxs(Fragment, { children: [child, 'two'] });

    expect(isElement(node)).toBe(true);
    expect(typeOf(node)).toBe(Fragment);
    expect(propsOf(node)).toEqual({ children: [child, 'two'] });
    expect(childrenOf(propsOf(node).children)).toEqual([child, 'two']);
    expect(typeOf('text')).toBeUndefined();
    expect(propsOf('text')).toEqual({});
  });

  it('will expose the development transform entry', () => {
    expect(isVNode(jsxDEV('div', {}, undefined, false, {}, null))).toBe(true);
    expect(isVNode(coreJsxDEV('div', {}, undefined, false))).toBe(true);
  });
});
