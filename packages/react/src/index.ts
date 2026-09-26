import { Component } from '@expressive/mvc';
import React, {
  createContext,
  createElement,
  Suspense,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react';

import './element';
import './jsx-runtime';

import { Runtime } from './adapter';
import { ErrorBoundary, dedupe } from './boundary';

// React detects class components by this brand (preact reads `prototype.render`).
Object.defineProperty(Component.prototype, 'isReactComponent', {
  value: true
});

Object.assign(Runtime, {
  dedupe,
  ErrorBoundary,
  createElement,
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useSyncExternalStore: React.useSyncExternalStore,
  transition: React.startTransition,
  Suspense,
  ignore: [
    'updater',
    'refs',
    '_reactInternals',
    '_reactInternalInstance'
  ]
});

export { Consumer, Provider } from './adapter';

/** @deprecated Import `State` from `@expressive/mvc`. This re-export will be removed. */
export { State } from './adapter';

/** @deprecated Import `{ State }` from `@expressive/mvc`. The default export will be removed. */
export { State as default } from './adapter';

/** @deprecated Import from `@expressive/mvc`. These re-exports will be removed. */
export { Component, Context, def, get, ref, set, pending } from '@expressive/mvc';

/** @deprecated Import `has` from `@expressive/mvc`. This re-export will be removed. */
export { has } from './has';

/** @deprecated Import `map` from `@expressive/mvc`. This re-export will be removed. */
export { map } from './map';
