import Model from '@expressive/mvc';
import { ReactNode, useMemo } from 'react';

export function component<P extends Model.Values<T>, T extends Model> (
  this: Model.New<T>,
  render: (using: T & P) => ReactNode){

  const Component = ((inputProps: P) => {
    const props = this.use(inputProps) as T & P;
    const keys = useMemo(() => new Set(Object.keys(props)), []);

    for(const key in inputProps)
      if(!keys.has(key))
        Object.defineProperty(props, key, { value: inputProps[key] });

    return render(props);
  }) as Model.Component<P, T>;

  Component.using = this;
  Component.displayName = this.name;
  
  return Component;
}