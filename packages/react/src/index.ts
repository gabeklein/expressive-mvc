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

declare module '@expressive/mvc' {
  interface Component {
    /** @deprecated Only to satisfy host JSX. */
    readonly type: typeof Component;
  }
}

function toElement(template: any) {
  Object.defineProperty(Component.prototype, '$$typeof', {
    get(this: Component) {
      const from = this;
      const descriptors = Object.getOwnPropertyDescriptors(template);
      const store = descriptors._store?.value;

      function Host() {
        return from;
      }

      Object.setPrototypeOf(Host, Component);
      Host.prototype = Component.prototype;

      delete descriptors.props;

      if (store)
        descriptors._store.value = Object.create(
          Object.getPrototypeOf(store),
          Object.getOwnPropertyDescriptors(store)
        );

      Object.defineProperties(this, {
        ...descriptors,
        $$typeof: { value: template.$$typeof },
        type: { value: Host },
        key: { value: this.key }
      });

      return template.$$typeof;
    }
  });
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

toElement(createElement('template'));

export { State, State as default, use, Consumer, Provider } from './adapter';
export { Component, Context, def, get, ref, set, hot } from '@expressive/mvc';
