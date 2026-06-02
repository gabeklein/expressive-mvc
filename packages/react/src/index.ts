import { createElement, useEffect, useRef, useState } from 'react';

import { State } from './state';
import { Runtime } from './runtime';
import { Consumer, Provider } from './context';

Runtime.createElement = createElement;
Runtime.useEffect = useEffect;
Runtime.useState = useState;
Runtime.useRef = useRef;

export { State, State as default };
export { Context, Observable, def, get, ref, set, hot } from '@expressive/mvc';
export { Component } from './component';
export { use } from './use';
export { Consumer, Provider };
