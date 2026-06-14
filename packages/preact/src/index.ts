import { State, Runtime, use, Consumer, Provider } from '@expressive/react/state';
import {
  createContext,
  createElement,
  Suspense,
  useContext,
  useEffect,
  useRef,
  useState
} from 'preact/compat';

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
export { Component } from './component';
export { use };
export { Consumer, Provider };
