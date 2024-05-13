import { Model } from '@expressive/mvc';

declare module '@expressive/mvc' {
  namespace Model {
    interface Component<T extends Model, P extends Model.Assign<T>> {
      (props: P): JSX.Element | null;

      displayName?: string;
      Model: Model.Type<T>;
    }

    /**
     * Creates a component which reflects this Model. All managed properties may be assigned using props.
     * 
     * @param render Function which renders component. This function receives all Model state merged with props. Normal subscription behavior still applies.
     */
    function as <T extends Model, P extends Model.Assign<T>> (
      this: Model.Init<T>, render: (using: P) => JSX.Element | null
    ): Component<T, P & Model.Assign<T>>;
  }
}

Model.as = function <T extends Model, P extends Model.Assign<T>> (
  this: Model.Init<T>, render: (using: P) => JSX.Element | null){

  if(this === Model)
    throw new Error("Cannot create component from base Model.");

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