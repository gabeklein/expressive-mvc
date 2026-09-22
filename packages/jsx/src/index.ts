import './adapter';
import './jsx-runtime';

import { appearance } from './appearance';
import { createRender } from './render';

const render = createRender(appearance);

export { Consumer, Provider } from './context';
export { lazy } from './lazy';
export { render };
export { createPortal } from './vnode';

export { State, State as default, Component, Context, def, get, has, map, ref, set, pending } from '@expressive/mvc';
