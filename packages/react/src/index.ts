import { Component } from '@expressive/mvc';
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
import { configureElement } from './component';

declare module '@expressive/mvc' {
  interface Component {
    readonly $$typeof: symbol;
    readonly type: typeof Component;
    readonly key: string;
  }
}

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

configureElement(createElement('template'));

export { State, State as default, use, Consumer, Provider } from './adapter';
export { Component, Context, def, get, ref, set, hot } from '@expressive/mvc';
