import Model from '@expressive/mvc';
import { ReactNode } from 'react';

export function createComponent<T extends Model, P extends Model.Values<T>> (
  this: Model.New<T>,
  render: (using: T & P) => ReactNode){

  const Component = ((inputProps: P) => {
    const props = this.use(inputProps, true) as T & P;

    for(const key in inputProps)
      if(!(key in props))
        Object.defineProperty(props, key, { value: inputProps[key] });

    return render(props);
  }) as Model.Component<T, P>;

  Component.using = this;
  Component.displayName = this.name;
  
  return Component;
}