declare module '@expressive/mvc' {
  namespace Model {
    type HasProps<T extends Model> = {
      [K in Exclude<keyof T, keyof Model>]?: T[K];
    }

    /**
     * Props which will not conflict with a Model's use as a Component.
     * 
     * Built-in properties must be optional, as they will always be omitted.
     */
    type RenderProps<T extends Model> = HasProps<T> & {
      is?: undefined;
      get?: undefined;
      set?: undefined;
    };

    /** Model which is not incompatable as Component in React. */
    interface Compat extends Model {
      render?(props: RenderProps<this>): React.ReactNode;
      fallback?: React.ReactNode;
    }

    interface BaseProps<T extends Model> {
      /**
       * Callback for newly created instance. Only called once.
       * @returns Callback to run when instance is destroyed.
       */
      is?: (instance: T) => void;

      /**
       * A fallback react tree to show when suspended.
       * If not provided, `fallback` property of the Model will be used.
       */
      fallback?: React.ReactNode;
    }

    type Props<T extends Model> = 
      T extends { render(props: infer P, self: any): any }
        ? BaseProps<T> & HasProps<T> & Omit<P, keyof Model>
        : BaseProps<T> & HasProps<T> & { children?: React.ReactNode };
  }
}

const Hook = {} as {
  useState<S>(initial: () => S): [S, (next: (previous: S) => S) => void];
  useEffect(effect: () => () => void, deps?: any[]): void;
};

export { Hook };

import "./model.as";
import './model.use';
import './model.get';