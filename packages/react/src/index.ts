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
import { State } from './state';
import { Runtime } from './component';
import { Consumer, Provider } from './context';

Object.assign(Runtime, {
  createElement,
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  Suspense
});

export { State, State as default };
export { Context, Observable, def, get, ref, set, hot } from '@expressive/mvc';
export { Component } from './runtime';
export { use } from './use';
export { Consumer, Provider };
