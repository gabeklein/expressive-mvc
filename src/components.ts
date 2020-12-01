import type { ChangeEventHandler, FC, HTMLProps, KeyboardEventHandler, PropsWithChildren } from 'react';
import type { ControllableRefFunction } from '..';

import { Children, createElement, forwardRef, useMemo, memo } from 'react';

import { Controller } from './controller';
import { useValue } from './hooks';

type ChangeCallback = (v: any, e: any) => any;

type ControlledInputProps<T> = 
  & HTMLProps<HTMLInputElement>
  & ControlledProps<T>;
  
type ControlledProps<T extends {}> = {
  to: keyof T, 
  type?: string,
  onUpdate?: ChangeCallback | string | false,
  onReturn?: ChangeCallback | string
}

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

export function ControlledValue<T extends Controller>(
  this: T): FC<{ of: keyof T }> {

  return ({ of: key, ...props }) =>
    createElement("span", props, useValue(this, key));
}

export function ControlledInput<T extends Controller>(this: T){
  return forwardRef((props: ControlledInputProps<T>, ref) => {
    const { to, onUpdate, onReturn, ...passProps } = props;

    const value = useValue(this, to);
    const events = useMemo(() => controlledEventProps(this, props as any), []);
    
    return createElement("input", { ...passProps, ...events, ref, value });
  })
}

function controlledEventProps(
  control: Controller & Any,
  inputProps: ControlledInputProps<{}>){

  let { to, type, onUpdate, onReturn } = inputProps;

  const handle = {} as {
    onChange?: ChangeEventHandler<HTMLInputElement>,
    onKeyPress?: KeyboardEventHandler<HTMLInputElement>
  }

  if(typeof onUpdate == "string")
    onUpdate = control[onUpdate] as ChangeCallback;

  if(typeof onReturn == "string")
    onReturn = control[onReturn] as ChangeCallback;

  if(typeof onUpdate == "function"){
    const custom = onUpdate;

    handle.onChange = function intercept(event){
      const { value } = event.target;

      const returned = custom(
        type == "number" ? Number(value) : value,
        event
      );

      if(returned !== undefined)
        control[to] = returned;
    }
  }
  else if(onUpdate !== false)
    handle.onChange = function updateValue(event){
      const { value } = event.target;
      control[to] = type == "number" ? Number(value) : value;
    };

  if(typeof onReturn == "function"){
    const custom = onReturn;

    handle.onKeyPress = 
      function onMaybeEnterKeyPress(e){
        if(e.which !== 13)
          return;

        const { value } = e.currentTarget;

        e.preventDefault();

        const returned = custom(
          type == "number" ? Number(value) : value,
          event
        );

        if(returned)
          control[to] = returned;
      }
    }

  return handle;
}