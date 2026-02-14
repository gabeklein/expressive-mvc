import { State } from '@expressive/mvc';

import { createElement, useEffect, useState } from 'react';

import { ReactState, Pragma } from './state';

Pragma.useEffect = useEffect;
Pragma.useState = useState;
Pragma.createElement = createElement;

/**
 * Augmented State namespace to include ReactState hooks as static methods.
 *
 * This retroactively adds React support to agnostic State defined
 * by component libraries which import `@expressive/mvc` directly.
 */
declare module '@expressive/mvc' {
  namespace State {
    export import as = ReactState.as;
    export import as2 = ReactState.as2;
    export import get = ReactState.get;
    export import use = ReactState.use;
  }
}

State.get = ReactState.get;
State.use = ReactState.use;
State.as = ReactState.as;
State.as2 = ReactState.as2;

export { ReactState as State, ReactState as default };
export { Context, Observable, get, use, ref, set } from '@expressive/mvc';
export { Component } from './component';
export { Consumer, Provider } from './context';
export { Fragment, createElement } from 'react';
export { Pragma };