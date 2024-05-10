import { Model } from '@expressive/mvc';
import { Pragma } from '../core';

export function createComponent<T extends Model, P extends Model.Assign<T>> (
  this: Model.Init<T>, render: Pragma.FC<T & P>){

  if(this === Model)
    throw new Error("Cannot create component from base Model.");

  const Component: Model.Component<T, P> = (inputProps) => {
    const props = this.use(inputProps, true) as T & P;

    for(const key in inputProps)
      if(!(key in props))
        Object.defineProperty(props, key, { value: inputProps[key] });

    return render(props);
  };

  Component.Model = this;
  Component.displayName = this.name;
  
  return Component;
}