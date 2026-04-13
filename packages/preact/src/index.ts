import { State, Pragma } from '@expressive/react/state';
import { get, def, ref, set, Observable } from '@expressive/state';

import { useEffect, useState, createElement, useRef } from 'preact/compat';

Pragma.useEffect = useEffect;
Pragma.useState = useState;
Pragma.createElement = createElement;
Pragma.useRef = useRef;

export default State;
export { get, State, Observable, ref, set, def };
export { Consumer, Provider, Context } from './context';
