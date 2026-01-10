import Runtime from 'react/jsx-dev-runtime';

import { patch } from './jsx-runtime';

export const jsxDEV = patch.bind(Runtime.jsxDEV);

export { type JSX } from './jsx-runtime';
export { Fragment } from 'react';
