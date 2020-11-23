import type {
  ChangeEventHandler,
  ComponentClass,
  ComponentType,
  FC,
  FunctionComponent,
  HTMLProps,
  KeyboardEventHandler,
  PropsWithChildren
} from 'react';

import { Children, createElement, forwardRef, useMemo } from 'react';

import { Controller } from './controller';
import { useValue } from './hooks';
import Oops from './issues';

type ChangeCallback = (v: any, e: any) => any;

type ControlledInputProps = 
  & HTMLProps<HTMLInputElement>
  & ControlledProps;
  
type ControlledProps = {
  to: string, 
  type?: string,
  onUpdate?: ChangeCallback | string | false,
  onReturn?: ChangeCallback | string
}

type HOCFactory = (control: Controller) => ComponentType

export function createHocFactory(
  Type: ComponentType): HOCFactory {

  if(typeof Type !== "function")
    throw Oops.BadHOCArgument();

  const proto = Type.prototype;
    
  if(proto && proto.isReactComponent)
    return (control) => 
      class extends (Type as ComponentClass) {
        constructor(props: any){
          super(props, control)
        }
      }
  else
    return (control) =>
      (props: any) =>
        (Type as FunctionComponent)(props, control);
}

export function createProviderHOC(
  Component: ComponentType,
  control: Controller){

  return (props: any) =>
    createElement(control.Provider, {}, 
      createElement(Component, props)
    );
}

export function Noop({ children }: PropsWithChildren<{}>){
  return Children.only(children);
}

export function ControlledValue(
  this: Controller): FC<{ of: string }> {

  return ({ of: key, ...props }) =>
    createElement("span", props, useValue(this, key));
}

export function ControlledInput(this: Controller){
  return forwardRef((props: ControlledInputProps, ref) => {
    const { to, onUpdate, onReturn, ...passProps } = props;

    const value = useValue(this, to);
    const events = useMemo(() => controlledEventProps(this, props), []);
    
    return createElement("input", { ...passProps, ...events, ref, value });
  })
}

function controlledEventProps(
  control: Controller & Any,
  inputProps: ControlledInputProps){

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