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
  onChange?: (v: any, e: any) => any
}> {
  return forwardRef((props, ref) => {
    const source: any = this;
    const { to } = props;

    const [controlled, onDidUpdate] = useManualRefresh(() => {
      const { onChange } = props;

      return {
        type: "text",
        onChange: 
          onChange ?
            (e: any) => { source[to] = onChange(e.target.value, e) } :
          props.type !== "number" ? 
            (e: any) => { source[to] = e.target.value } : 
            (e: any) => { source[to] = Number(e.target.value) }
      }
    });

    props = <any>{
      ref,
      value: source[to],
      ...controlled,
      ...props
    }

    useEffect(() => {
      return this[DISPATCH]!.addListener(to, onDidUpdate);
    });

    delete props.to;
    return createElement("input", props)
  })
}