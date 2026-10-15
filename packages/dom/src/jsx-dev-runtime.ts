import { Fragment } from '@expressive/mvc/jsx-runtime';

import { vnode } from './node/vnode';
import type { VNode } from './node/vnode';

function jsxDEV(
  type: VNode['type'],
  props: object,
  key?: unknown,
  _isStatic?: boolean,
  _source?: object,
  _self?: unknown
) {
  return vnode(type, props, key);
}

export { Fragment, jsxDEV };
export { hot } from './render/hot';
export type { JSX } from '@expressive/mvc/jsx-runtime';
