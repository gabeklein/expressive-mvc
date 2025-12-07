import { useEffect, useState } from 'react';

import { Hook } from './adapter';

Hook.useEffect = useEffect;
Hook.useState = useState;

export {
  Observable,
  Model, Model as default,
  get, use, ref, set, has
} from '@expressive/mvc';

export { Consumer, Context, Provider } from './context';
export { Fragment, createElement } from 'react';
export { type Hook as Pragma };
