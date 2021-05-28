import Model from '.';

/**
 * Observable Instance
 * 
 * Implements internal value tracking. 
 * Able to be subscribed to, per-value to know when updated.
 */
interface Dispatch {
  on <S extends Model.SelectEvent<this>> (via: S, cb: ValueCallback<this, ReturnType<S>>, initial?: boolean): Callback;
  on <P extends Model.Events<this>> (property: P, listener: UpdateCallback<this, P>, initial?: boolean): Callback;

  once <S extends Model.SelectEvent<this>> (via: S): Promise<ReturnType<S>>;
  once <S extends Model.SelectEvent<this>> (via: S, cb: ValueCallback<this, ReturnType<S>>): Callback;
  once <P extends Model.Events<this>> (property: P): Promise<this[P]>;
  once <P extends Model.Events<this>> (property: P, listener: UpdateCallback<this, P>): void;

  effect(callback: EffectCallback<this>, select?: Model.SelectFields<this>): Callback;
  effect(callback: EffectCallback<this>, select?: (keyof this)[]): Callback;

  export(): Model.Entries<this>;
  export <P extends Model.Fields<this>> (select: P[]): Pick<this, P>;
  export(select: Model.SelectFields<this>): Model.Data<this>;

  update <O extends Model.Data<this>> (via: O): void;
  update(keys: Model.SelectFields<this>): void;
  update(keys: Model.Fields<this>[]): void;

  requestUpdate(strict?: boolean): Promise<string[] | false>;
  requestUpdate(cb: (keys: string[]) => void): void;
}

export = Dispatch;