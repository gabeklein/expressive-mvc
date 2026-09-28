import '@expressive/inspect/install';

import { render } from '@expressive/dom';
import { jsx } from '@expressive/dom/jsx-runtime';

import { loadFrame } from '../pages';

const { default: Example } = await loadFrame()();

render(jsx(Example, {}), document.getElementById('root')!);
