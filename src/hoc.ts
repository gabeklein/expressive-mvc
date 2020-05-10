import { createElement, FC, forwardRef, useEffect } from 'react';

import { Controller } from './controller';
import { DISPATCH } from './dispatch';
import { useManualRefresh } from './subscription';

export function ControlledValue(this: Controller): FC<{ of: string }> {
  return (props) => {
    const onDidUpdate = useManualRefresh()[1];
    
    props = { ...props };

    useEffect(() => {
      return this[DISPATCH]!.addListener(props.of, onDidUpdate);
    })

    delete props.of;
    return createElement("span", props, (<any>this)[props.of])
  }
}

export function ControlledInput(this: Controller): FC<{ 
  to: string, 
  type?: string,
  onChange?: ((v: any, e: any) => any) | false,
  onReturn?: (v: any, e: any) => any
}> {
  return forwardRef((props, ref) => {
    const source: any = this;
    const { to } = props;

    const [controlled, onDidUpdate] = useManualRefresh(() => {
      const { onChange, onReturn, type } = props;
      const meta = {} as any;

      if(typeof onChange == "function")
        meta.onChange = (e: any) => {
          let v = e.target.value;
          if(type == "number")
            v = Number(v);
          const o = onChange(v, e);
          if(o)
            source[to] = o;
        }
      else if(onChange !== false) {
        if(type == "number")
          meta.onChange = (e: any) => { source[to] = Number(e.target.value) }
        else
          meta.onChange = (e: any) => { source[to] = e.target.value }
      }

      if(typeof onReturn == "function"){
        meta.onKeyPress = (e: any) => {
          if(e.which !== 13)
            return;

          e.preventDefault();
          let v = e.target.value;
          if(type == "number")
            v = Number(v);
          const o = onReturn(v, e);
          if(o)
            source[to] = o;
        }

      }

      return meta;
    });

    props = <any>{
      ref,
      value: source[to],
      type: "text",
      ...props,
      ...controlled
    }

    useEffect(() => {
      return this[DISPATCH]!.addListener(to, onDidUpdate);
    });

    delete props.to;
    delete props.onReturn;
    return createElement("input", props)
  })
}