import {
  Context,
  Observable,
  Model,
  get,
  use,
  ref,
  set,
  has
} from '@expressive/mvc';
import { createElement, useEffect, useState } from 'react';

import { Pragma } from './compat';

Pragma.useEffect = useEffect;
Pragma.useState = useState;
Pragma.createElement = createElement;

export default Model;
export { Context, get, has, Model, Observable, ref, set, use };
export { Consumer, Provider } from './context';
export { Fragment, createElement } from 'react';
