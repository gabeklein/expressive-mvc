import { Fragment } from '@expressive/mvc/runtime';

import { markStatic, vnode } from './vnode';
import type { VNode } from './vnode';

function jsxDEV(
  type: VNode['type'],
  props: object,
  key?: unknown,
  isStatic?: boolean,
  _source?: object,
  _self?: unknown
) {
  if (isStatic) markStatic(props);
  return vnode(type, props, key);
}

export { Fragment, jsxDEV };
export type { JSX } from '@expressive/mvc/jsx-runtime';
