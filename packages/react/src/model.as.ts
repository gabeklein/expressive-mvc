import { Model } from '@expressive/mvc';

declare module '@expressive/mvc' {
  namespace Model {
    interface Component<T extends Model, P = {}> {
      (props: Model.Props<T> & P): JSX.Element | null;

      displayName?: string;
      Model: Model.Type<T>;
    }

    /**
     * Creates a component which reflects this Model. All managed properties may be assigned using props.
     * 
     * @param render Function which renders component. This function receives all Model state merged with props. Normal subscription behavior still applies.
     */
    function as <T extends Model.Compat, P = {}> (
      this: Model.Init<T>, 
      render: (props: P & Partial<T>, self: T) => React.ReactNode
    ): Component<T, P>;
  }
}

Model.as = function <T extends Model, P = {}> (
  this: Model.Init<T>, 
  render: (props: T & P, self: T) => React.ReactNode
){
  if(this === Model)
    throw new Error("Cannot create component from base Model.");

  const Component = ((inputProps: any) => {
    const { is, ...rest } = inputProps;
    const instance = this.use(instance => {
      instance.set(rest);
      return is(instance);
    }) as T;
    
    // Handle lifecycle callback similar to JSX runtime
    if (is && typeof is === 'function') {
      // This is simplified - in a real implementation would need
      // to handle unmount callbacks like the JSX runtime does
      is(instance);
    }

    // Copy non-managed props to the props object
    const props = { ...instance } as T & P;

    for(const key in rest)
      if(!(key in instance))
        Object.defineProperty(props, key, { value: rest[key] });

    return render(props, instance);
  }) as Model.Component<T, P>;

  Component.Model = this;
  Component.displayName = this.name;
  
  return Component;
}