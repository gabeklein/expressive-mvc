/// <reference path="../types.d.ts" />

import { Model } from '@expressive/mvc';

import { createComponent } from './component';
import { useLocal } from './useLocal';
import { useRemote } from './useRemote';

Model.as = createComponent;
Model.get = useRemote;
Model.use = useLocal;

export { Model, Model as default };
export { get, use, ref, set, has } from '@expressive/mvc';
export { Consumer } from "./consumer";
export { Provider } from "./provider";