import { Model, get, use, ref, set, has, Observable } from '@expressive/mvc';
import { Pragma } from '@expressive/react/adapter';

import { useEffect, useState } from 'preact/compat';

Pragma.useEffect = useEffect;
Pragma.useState = useState;

export default Model;
export { get, has, Model, Observable, ref, set, use };
export { Consumer, Provider } from './context';
