import { State, Runtime, use } from '@expressive/react/state';
import { useEffect, useState, createElement, useRef } from 'preact/compat';

Runtime.createElement = createElement;
Runtime.useEffect = useEffect;
Runtime.useState = useState;
Runtime.useRef = useRef;

export { State, State as default };
export { Context, Observable, def, get, ref, set, hot } from '@expressive/mvc';
export { Component } from './component';
export { use };
export { Consumer, Provider } from './context';
