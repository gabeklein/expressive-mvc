import { Fragment } from '@expressive/mvc/runtime';

import { vnode } from './vnode';
import type { VNode } from './vnode';

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
export type { JSX } from '@expressive/mvc/jsx-runtime';
