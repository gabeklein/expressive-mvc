import { createElement, forwardRef, useEffect } from 'react';

import { Controller, within } from './controller';
import { useManualRefresh } from './hook';
import { getObserver } from './observer';

type onChangeCallback = (v: any, e: any) => any;

type ControlledInputProps = { 
  to: string, 
  type?: string,
  onChange?: onChangeCallback | false,
  onReturn?: onChangeCallback
}

export function ControlledInput(this: Controller){
  return forwardRef<unknown, ControlledInputProps>((props, ref) => {
    const { to, onChange, onReturn, ...outsideProps } = props;
    const controlledProps = useControlledInputProps.call(this, props.to, props)
    
    return createElement("input", {
      ref,
      ...outsideProps,
      ...controlledProps
    })
  })
}

function useControlledInputProps(
  this: Controller,
  key: string,
  props: Omit<ControlledInputProps, "to">){

  const [controlProps, onDidUpdate] = useManualRefresh(() => {
    let { onChange, onReturn, type } = props;
    const tracked = within(this);
    const controlProps = {} as any;

    if(typeof onChange == "string")
      onChange = this[onChange] as onChangeCallback;

    if(typeof onChange == "function")
      controlProps.onChange = (e: any) => {
        let { value } = e.target;

        if(type == "number")
          value = Number(value);

        const returned = (onChange as any)(value, e);

        if(returned !== undefined)
          tracked[key] = returned;
      }
    else if(onChange !== false)
      if(type == "number")
        controlProps.onChange = (e: any) => { 
          tracked[key] = Number(e.target.value) 
        }
      else
        controlProps.onChange = (e: any) => { 
          tracked[key] = e.target.value 
        }

    if(typeof onReturn == "string")
      onReturn = this[onReturn] as onChangeCallback;

    if(typeof onReturn == "function"){
      controlProps.onKeyPress = (e: any) => {
        if(e.which !== 13)
          return;

        e.preventDefault();
        let { value } = e.target;

        if(type == "number")
          value = Number(value);

        const returned = (onReturn as any)(value, e);

        if(returned)
          tracked[key] = returned;
      }
    }

    return controlProps;
  });

  useEffect(() => {
    return getObserver(this).addListener(key, onDidUpdate);
  }, []);

  return {
    ...controlProps,
    value: within(this, key),
    type: "text"
  }
}