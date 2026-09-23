import { describe, expect, it } from 'vitest';

import { PORTAL, VNODE, childrenOf, createPortal, isVNode, markStatic, segmentsOf, vnode } from './vnode';

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

  it('will create a portal node', () => {
    const container = document.createElement('aside');
    const portal = createPortal('hello', container, 'modal');

    expect(portal.type).toBe(PORTAL);
    expect(portal.key).toBe('modal');
    expect(portal.props).toEqual({ children: 'hello', container });
  });

  it('will assign static positions and collapse dynamic arrays', () => {
    const rows = ['a', 'b'];
    const children = ['head', false, rows, 'foot'];

    markStatic({ children: 'solo' });
    markStatic({ children });

    expect(segmentsOf(children)).toEqual(['0', '2*', '2*', '3']);
    expect(segmentsOf(vnode('i', {}, 'a'))).toEqual(['~a']);
    expect(segmentsOf([vnode('i', {}, 'a')])).toEqual(['*']);
    expect(segmentsOf(rows)).toEqual(['*', '*']);
    expect(segmentsOf('solo')).toEqual(['']);
  });
});
