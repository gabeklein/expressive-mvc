import { Context, Observable, get, use, ref, set } from '@expressive/mvc';

import { createElement, useEffect, useState } from 'react';

import { Pragma } from './adapter';
import { ReactState } from './state';

Pragma.useEffect = useEffect;
Pragma.useState = useState;
Pragma.createElement = createElement;

export default ReactState;
export { Context, get, ReactState as State, Observable, ref, set, use };
export { Consumer, Provider } from './context';
export { Fragment, createElement } from 'react';
export { Pragma };
