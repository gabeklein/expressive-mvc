import { State, get, use, ref, set, Observable } from '@expressive/mvc';
import { Pragma } from '@expressive/react/adapter';

import { useEffect, useState, createElement } from 'preact/compat';

Pragma.useEffect = useEffect;
Pragma.useState = useState;
Pragma.createElement = createElement;

export default State;
export { get, State, Observable, ref, set, use };
export { Consumer, Provider } from './context';
