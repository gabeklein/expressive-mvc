import { createElement, useEffect, useRef, useState } from 'react';

import { Consumer, Provider } from './context';
import { State } from './state';
import { Pragma } from './runtime';

Pragma.useEffect = useEffect;
Pragma.useState = useState;
Pragma.createElement = createElement;
Pragma.useRef = useRef;

export { State, State as default };
export { Context, Observable, def, get, ref, set } from '@expressive/state';
export { Component } from './component';
export { Consumer, Provider };
