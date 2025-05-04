import { jsxDEV, JSXSource } from 'react/jsx-dev-runtime';

import Model from '.';
import { compat } from './jsx-runtime';

function jsxDEV2(
  type: React.ElementType | Model.Init,
  props: Record<string, any>,
  key: React.Key,
  isStatic: boolean,
  source?: JSXSource,
  self?: unknown) {

  return jsxDEV(compat(type), props, key, isStatic, source, self);
}

export { jsxDEV2 as jsxDEV };
export { type JSX } from './jsx-runtime';
export { Fragment } from "react";
