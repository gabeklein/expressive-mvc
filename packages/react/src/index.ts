import { get, Model } from '@expressive/mvc';

import Adapter from './adapter';

import { getContext, useLocal } from './useLocal';
import { useRemote } from './useRemote';

Model.get = useRemote;
Model.use = useLocal;

get.context = getContext;

export * from '@expressive/mvc';

export { Model as default };
export { Consumer } from "./consumer";
export { Provider } from "./provider";