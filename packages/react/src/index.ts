import { Component } from '@expressive/mvc';
import * as React from 'react';

import './element';
import './jsx-runtime';

import { Runtime } from './adapter';
import { weak } from './runtime';
import { ErrorBoundary, dedupe } from './boundary';
import { idle } from './idle';

// React detects class components by this brand (preact reads `prototype.render`).
Object.defineProperty(Component.prototype, 'isReactComponent', {
  value: true
});

const FIBER = new WeakMap<Component, { deref(): unknown }>();

Object.defineProperty(Component.prototype, '_reactInternals', {
  get(this: Component) {
    return FIBER.get(this)?.deref();
  },
  set(this: Component, fiber: object) {
    FIBER.set(this, weak(fiber));
  }
});

Object.assign(Runtime, {
  idle: idle(React),
  dedupe,
  ErrorBoundary,
  createElement: React.createElement,
  createContext: React.createContext,
  useContext: React.useContext,
  useEffect: React.useEffect,
  useState: React.useState,
  useRef: React.useRef,
  useSyncExternalStore: React.useSyncExternalStore,
  startTransition: React.startTransition,
  Suspense: React.Suspense,
  ignore: [
    'updater',
    'refs',
    '_reactInternalInstance'
  ]
});

// Nothing is exported for app code - `Model`, `Component` and the instructions come
// from `@expressive/mvc`. These register `has` and `map` collections as renderable.
import './has';
import './map';
