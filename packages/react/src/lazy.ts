import Model from ".";

/** Type may not be undefined - instead will be null.  */
type NoVoid<T> = T extends undefined | void ? null : T;

type Lazy<T extends Model> = {
  Model: Promise<Model.Type<T>>;

  get(passive?: true): T;
  get(this: Model.Type<T>, required: boolean): T | undefined;
  get<R>(this: Model.Type<T>, factory: Model.get.Factory<T, Promise<R> | R>): NoVoid<R>;
  get<R>(this: Model.Type<T>, factory: Model.get.Factory<T, null>): NoVoid<R> | null;

  as <P = {}> (
    render: (using: T & P) => React.ReactNode
  ): Model.Component<T, P & Model.Assign<T>>;
}

declare function lazy<T extends Model>(from: Model.Type<T>): Lazy<T>;

declare function lazy<T extends Model>(
  importFactory: () => Promise<{ default: Model.Type<T> }>
): Lazy<T>;

class Something extends Model {
  foo = 0;
}

const LazySomething = lazy(async () => ({ default: Something }));

export { lazy }