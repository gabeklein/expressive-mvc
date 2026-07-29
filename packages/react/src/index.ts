import { Component, Context } from '@expressive/mvc';
import {
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
  Suspense,
  ignore: [
    'updater',
    'refs',
    '_reactInternals',
    '_reactInternalInstance'
  ]
});

// No DOM implies a server render, where the shared root context is reused
// across requests; flag it so a context-less non-global (usually a missing
// per-request Provider) warns on activation.
Context.server = typeof window === 'undefined';

export { State, State as default, use, Consumer, Provider } from './adapter';
export { Component, Context, def, get, ref, set } from '@expressive/mvc';
export { has } from './has';
export { map } from './map';
