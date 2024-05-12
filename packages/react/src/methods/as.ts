import { Model } from '@expressive/mvc';

declare module '@expressive/mvc' {
  namespace Model {
    interface Component<T extends Model, P extends Model.Assign<T>> {
      (props: P): React.ReactNode;

      displayName?: string;
      Model: Model.Type<T>;
    }

    interface Render <T extends Model, P extends Model.Assign<T>> {
      (using: P): React.ReactNode;
    }

    /**
     * Creates a component which reflects this Model. All managed properties may be assigned using props.
     * 
     * @param render Function which renders component. This function receives all Model state merged with props. Normal subscription behavior still applies.
     */
    function as <T extends Model, P extends Model.Assign<T>> (
      this: Model.Init<T>, render: Render<T, P>
    ): Component<T, P & Model.Assign<T>>;
  }
}

Model.as = function <T extends Model, P extends Model.Assign<T>> (
  this: Model.Init<T>, render: Model.Render<T, P>){

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