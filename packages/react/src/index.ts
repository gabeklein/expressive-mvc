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
import { Runtime } from './host';
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

export { State, State as default, use } from './host';
export { Component, Context, Observable, def, get, ref, set, hot } from '@expressive/mvc';
export { Consumer, Provider } from './context';
