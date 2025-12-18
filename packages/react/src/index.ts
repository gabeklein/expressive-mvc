import { Observable, Model, get, use, ref, set, has } from '@expressive/mvc';
import { useEffect, useState } from 'react';

import { Hook } from './adapter';

Hook.useEffect = useEffect;
Hook.useState = useState;

export default Model;
export { get, has, Model, Observable, ref, set, use };
export { Consumer, Context, Provider } from './context';
export { Fragment, createElement } from 'react';
