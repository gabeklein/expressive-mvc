import { State as BaseState } from '@expressive/mvc';

import { createElement, useEffect, useState } from 'react';

import { ReactState, Pragma } from './state';

Pragma.useEffect = useEffect;
Pragma.useState = useState;
Pragma.createElement = createElement;

/**
 * Augmented State namespace to include ReactState hooks as static methods.
 *
 * This retroactively adds React to library-agnostic State defined
 * by component libraries which import `@expressive/mvc` directly.
 */
declare module '@expressive/mvc' {
  namespace State {
    export import as = ReactState.as;
    export import get = ReactState.get;
    export import use = ReactState.use;
  }
}

BaseState.get = ReactState.get;
BaseState.use = ReactState.use;
BaseState.as = ReactState.as;

export { ReactState as State, ReactState as default };
export { Context, Observable, get, use, ref, set } from '@expressive/mvc';
export { Consumer, Provider } from './context';
export { Fragment, createElement } from 'react';
export { Pragma };
