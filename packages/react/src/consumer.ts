import { Model } from '../types';

import { useShared, useMemo } from './useContext';

interface ConsumerProps<T extends Model> {
  for: Model.Type<T>;
  has?: ((value: T) => void) | boolean;
  get?: (value: T | undefined) => void;
  children?: (value: T) => any;
}

function Consumer<T extends Model>(props: ConsumerProps<T>): any {
  const { children, has, get, for: Type } = props;

  if(typeof children == "function")
    return Type.get(children);

  const context = useShared();
  const instance = useMemo(() => {
    const instance = context.get(Type);

    if(!instance && has)
      throw new Error(`Could not find ${Type} in context.`);

    return instance as T;
  }, []);

  const callback = has || get;

  if(typeof callback == "function")
    callback(instance);

  return null;
}

export { Consumer };