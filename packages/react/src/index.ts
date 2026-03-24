import { State } from '@expressive/state';
import { createElement, useEffect, useRef, useState } from 'react';

import { Pragma } from './state';
import { Consumer, Provider } from './context';

import './component';

Pragma.useEffect = useEffect;
Pragma.useState = useState;
Pragma.createElement = createElement;
Pragma.useRef = useRef;

export { State, State as default };
export { Context, Observable, apply, get, ref, set } from '@expressive/state';
export { Component } from './component';
export { Consumer, Provider };
