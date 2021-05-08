import Controller from '.';

/**
 * Observable Instance
 * 
 * Implements internal value tracking. 
 * Able to be subscribed to, per-value to know when updated.
 */
interface Dispatch {
  on <S extends Controller.SelectEvent<this>> (via: S, cb: ValueCallback<this, ReturnType<S>>, initial?: boolean): Callback;
  on <P extends Controller.Events<this>> (property: P, listener: UpdateCallback<this, P>, initial?: boolean): Callback;

  once <S extends Controller.SelectEvent<this>> (via: S): Promise<ReturnType<S>>;
  once <S extends Controller.SelectEvent<this>> (via: S, cb: ValueCallback<this, ReturnType<S>>): Callback;
  once <P extends Controller.Events<this>> (property: P): Promise<this[P]>;
  once <P extends Controller.Events<this>> (property: P, listener: UpdateCallback<this, P>): void;

  effect(callback: EffectCallback<this>, select?: Controller.SelectFields<this>): Callback;
  effect(callback: EffectCallback<this>, select?: (keyof this)[]): Callback;

  export(): Controller.Entries<this>;
  export <P extends Controller.Fields<this>> (select: P[]): Pick<this, P>;
  export(select: Controller.SelectFields<this>): Controller.Values<this>;

  update <O extends Controller.Values<this>> (via: O): void;
  update(keys: Controller.SelectFields<this>): void;
  update(keys: Controller.Fields<this>[]): void;

  requestUpdate(strict?: boolean): Promise<string[] | false>;
  requestUpdate(timeout: number): Promise<string[] | false>;
  requestUpdate(cb: (keys: string[]) => void): void;
}

export = Dispatch;