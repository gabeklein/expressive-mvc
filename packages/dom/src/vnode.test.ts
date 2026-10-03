import { describe, expect, it } from 'vitest';

import { PORTAL, Portal, VNODE, childrenOf, isVNode, vnode } from './vnode';

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
    const to = document.createElement('aside');
    const node = vnode(Portal, { to, children: 'hello' }, 'modal');

    expect(node.type).toBe(PORTAL);
    expect(node.key).toBe('modal');
    expect(node.props).toEqual({ to, children: 'hello' });
  });
});
