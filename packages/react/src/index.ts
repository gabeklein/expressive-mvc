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
// across requests; seal root-registered states so they cannot accept
// per-request mutation and bleed between them.
Context.sealing = typeof window === 'undefined';

export { State, State as default, use, Consumer, Provider } from './adapter';
export { Component, Context, def, get, ref, set, hot } from '@expressive/mvc';
