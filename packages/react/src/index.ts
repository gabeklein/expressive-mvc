import {
  Context,
  Observable,
  State,
  get,
  use,
  ref,
  set,
  has
} from '@expressive/mvc';
import { createElement, useEffect, useState } from 'react';

import { Pragma } from './adapter';

Pragma.useEffect = useEffect;
Pragma.useState = useState;
Pragma.createElement = createElement;

export default State;
export { Context, get, has, State, Observable, ref, set, use };
export { Consumer, Provider } from './context';
export { Fragment, createElement } from 'react';
