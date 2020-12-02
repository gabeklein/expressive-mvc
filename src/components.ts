import type { PropsWithChildren } from 'react';
import type { ControllableRefFunction } from '..';

import { Children, memo } from 'react';

import { Controller } from './controller';

export function Noop({ children }: PropsWithChildren<{}>){
  return Children.only(children);
}

export function boundRefComponent(
  control: Controller,
  property: string,
  Inner: ControllableRefFunction<HTMLElement>){

  return memo((props: {}) => {
    return Inner(props, control.bind(property))
  })
}