import { Runtime } from '@expressive/react/state';
import {
  createContext,
  createElement,
  Suspense,
  useContext,
  useEffect,
  useRef,
  useState
} from 'preact/compat';

import './jsx-runtime';
import { ErrorBoundary } from './boundary';

Object.assign(Runtime, {
  createElement,
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  Suspense,
  ErrorBoundary,
  // Preact has no render-attempt stacking (no fiber-keyed supersession);
  // teardown is owned by the context, so dedupe is a no-op.
  dedupe: () => ({
    commit() {},
    remove() {}
  }),
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

export { State, State as default, Consumer, Provider, use } from '@expressive/react/state'
export { Component, Context, Observable, def, get, ref, set, hot } from '@expressive/mvc';
