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

const { useSyncExternalStore } = React;
const subscribe = () => () => {};
const useRevision = useSyncExternalStore &&
  ((getRevision: () => number) => {
    useSyncExternalStore(subscribe, getRevision, getRevision);
  });

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
  useRevision,
  Suspense,
  ignore: [
    'updater',
    'refs',
    '_reactInternals',
    '_reactInternalInstance'
  ]
});

export { State, State as default, Consumer, Provider } from './adapter';
export { Component, Context, def, get, ref, set, transition } from '@expressive/mvc';
export { has } from './has';
export { map } from './map';
