import { describe, expect, it } from 'vitest';

import { PORTAL, Portal, VNODE, childrenOf, createElement, isVNode, vnode } from './vnode';

describe('VNode', () => {
  it('will create and recognize nodes', () => {
    const node = vnode('p', { children: 'hello' }, 1);

    expect(node).toEqual({
      [VNODE]: true,
      type: 'p',
      props: { children: 'hello' },
      key: 1
    });
    expect(isVNode(node)).toBe(true);
    expect(isVNode({})).toBe(false);
    expect(isVNode(null)).toBe(false);
    expect(vnode('hr', null as never).props).toEqual({});
  });

  it('will flatten rendered children', () => {
    expect(childrenOf([0, ['one', null, false], undefined, true, 2n])).toEqual([
      0,
      'one',
      2n
    ]);
  });

  it('will create a portal node from the Portal element type', () => {
    const into = document.createElement('aside');
    const node = vnode(Portal, { into, children: 'hello' }, 'modal');

    expect(node.type).toBe(PORTAL);
    expect(node.key).toBe('modal');
    expect(node.props).toEqual({ into, children: 'hello' });
  });

  describe('createElement', () => {
    it('will match jsx for props, key and a single child', () => {
      expect(createElement('div', { id: 'a', key: 'k' }, 'x')).toEqual(
        vnode('div', { id: 'a', children: 'x' }, 'k')
      );
    });

    it('will pass several children as an array', () => {
      expect(createElement('ul', null, 'a', 'b').props.children).toEqual(['a', 'b']);
    });

    it('will keep props.children without child arguments', () => {
      expect(createElement('p', { children: 'kept' }).props).toEqual({ children: 'kept' });
    });

    it('will prefer child arguments over props.children', () => {
      expect(createElement('p', { children: 'old' }, 'new').props.children).toBe('new');
    });
  });
});
