import { State, Runtime, use } from '@expressive/react/state';
import { get, def, ref, set, Observable } from '@expressive/mvc';

import { useEffect, useState, createElement, useRef } from 'preact/compat';

Runtime.createElement = createElement;
Runtime.useEffect = useEffect;
Runtime.useState = useState;
Runtime.useRef = useRef;

export default State;
export { get, State, Observable, ref, set, def, use };
export { Consumer, Provider, Context } from './context';
