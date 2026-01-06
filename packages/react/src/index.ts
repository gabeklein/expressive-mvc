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
import { useEffect, useState } from 'react';

import { React } from './compat';

React.useEffect = useEffect;
React.useState = useState;

export default Model;
export { Context, get, has, Model, Observable, ref, set, use };
export { Consumer, Provider } from './context';
export { Fragment, createElement } from 'react';
