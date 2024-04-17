import { Model } from '@expressive/mvc';
import { ReactNode } from 'react';

export function createComponent<T extends Model, P extends Model.Assign<T>> (
  this: Model.Init<T>,
  render: (using: T & P) => ReactNode){

  Model.is(this);

  const Component = ((inputProps: P) => {
    const props = this.use(inputProps, true) as T & P;

    for(const key in inputProps)
      if(!(key in props))
        Object.defineProperty(props, key, { value: inputProps[key] });

    return render(props);
  }) as Model.Component<T, P>;

  Component.Model = this;
  Component.displayName = this.name;
  
  return Component;
}