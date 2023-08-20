import { Context, Model } from '@expressive/mvc';
import { FunctionComponentElement, ProviderProps, ReactNode } from 'react';

declare global {
  type Callback = () => void;

  namespace jest {
    interface Matchers<R> {
      /** Assert model does have one or more updates pending. */
      toUpdate(): Promise<R>;

      /** Assert model did update with keys specified. */
      toHaveUpdated<R>(...keys: string[]): Promise<R>; 
    }
  }
}

declare namespace Provider {
  type Element = FunctionComponentElement<ProviderProps<Context>>;

  type Item = Model | Model.New;

  type Multiple<T extends Item = Item> = { [key: string | number]: T };

  type Instance<E> = E extends (new () => any) ? InstanceType<E> : E extends Model ? E : never;

  type Props<T extends Item = Item> = MultipleProps<T> | NormalProps<T>;

  type NormalProps<E, I = Instance<E>> = {
    for: E;
    children?: ReactNode;
    use?: Model.Values<I>;
  }

  // FIX: This fails to exclude properties with same key but different type.
  type MultipleProps<T extends Item> = {
    for: Multiple<T>;
    children?: ReactNode;
    use?: Model.Values<Instance<T>>;
  }
}

export {
  Provider
}