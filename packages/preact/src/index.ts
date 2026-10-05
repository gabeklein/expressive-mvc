import { Runtime } from '@expressive/react/adapter';
import { Component } from '@expressive/mvc';
import { options, type ComponentChildren } from 'preact';
import * as compat from 'preact/compat';

import './jsx-runtime';
import { ErrorBoundary } from './boundary';

const vnode = options.vnode;

options.vnode = (node) => {
  vnode?.(node);
  reject(node.props.children);
};

function reject(children: ComponentChildren) {
  if (children instanceof Component)
    throw new TypeError(
      'Component instances cannot be rendered directly with @expressive/preact.'
    );

  if (Array.isArray(children))
    for (const child of children) reject(child);
}

Object.assign(Runtime, {
  idle: () => false,
  createElement: compat.createElement,
  createContext: compat.createContext,
  useContext: compat.useContext,
  useEffect: compat.useEffect,
  useState: compat.useState,
  useRef: compat.useRef,
  Suspense: compat.Suspense,
  ErrorBoundary,
  ignore: [
    '__v',
    '__n',
    '__d',
    '__e',
    '__h',
    '_sb',
    '__s',
    '__P',
    '__z',
    '__R',
    'base',
    'componentWillUnmount'
  ]
});

export { Provider } from '@expressive/react/adapter'

import { State } from '@expressive/react/adapter'

/** @deprecated Import `State` from `@expressive/mvc`. This re-export will be removed. */
export { State }

/** @deprecated Import `{ State }` from `@expressive/mvc`. The default export will be removed. */
export default State
/** @deprecated Import from `@expressive/mvc`. These re-exports will be removed. */
export { Component, Context, def, get, has, ref, set, map, pending } from '@expressive/mvc';
