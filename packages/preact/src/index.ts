import { Model, get, use, ref, set, has, Observable } from '@expressive/mvc';
import { React } from '@expressive/react/compat';

import { useEffect, useState } from 'preact/compat';

React.useEffect = useEffect;
React.useState = useState;

export default Model;
export { get, has, Model, Observable, ref, set, use };
export { Consumer, Provider } from './context';