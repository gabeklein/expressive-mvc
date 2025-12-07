import { Hook } from '@expressive/react/adapter';
import { useEffect, useState } from 'preact/compat';

Hook.useEffect = useEffect;
Hook.useState = useState;

export {
  Model, Model as default,
  get, use, ref, set, has
} from '@expressive/mvc';

export { Consumer, Provider } from './context';
export { type Hook };