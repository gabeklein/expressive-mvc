import { State, Pragma } from '@expressive/react/state';
import { get, apply, ref, set, Observable } from '@expressive/state';

import { useEffect, useState, createElement, useRef } from 'preact/compat';

Pragma.useEffect = useEffect;
Pragma.useState = useState;
Pragma.createElement = createElement;
Pragma.useRef = useRef;

export default State;
export { get, State, Observable, ref, set, apply };
export { Consumer, Provider, Context } from './context';
