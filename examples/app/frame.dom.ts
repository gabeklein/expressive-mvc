import '@expressive/inspect/install';

import { render } from '@expressive/dom';
import { jsx } from '@expressive/dom/jsx-runtime';

import { loadFrame } from '../pages';

const load = loadFrame();

history.replaceState(null, '', '/');

const { default: Example } = await load();

render(jsx(Example, {}), document.getElementById('root')!);
