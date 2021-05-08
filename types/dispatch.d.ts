/**
 * Observable Instance
 * 
 * Implements internal value tracking. 
 * Able to be subscribed to, per-value to know when updated.
 */
interface Dispatch {
  on <S extends SelectFunction<this>> (via: S, cb: ValueCallback<this, ReturnType<S>>, initial?: boolean): Callback;
  on <P extends keyof this> (property: P, listener: UpdateCallback<this, P>, initial?: boolean): Callback;

  once <S extends SelectFunction<this>> (via: S): Promise<ReturnType<S>>;
  once <S extends SelectFunction<this>> (via: S, cb: ValueCallback<this, ReturnType<S>>): Callback;

  once <P extends keyof this> (property: P): Promise<this[P]>;
  once <P extends keyof this> (property: P, listener: UpdateCallback<this, P>): void;

  effect(callback: EffectCallback<this>, select?: (keyof this)[] | QueryFunction<this>): Callback;

  export(): this;
  export <P extends keyof this> (select: P[] | QueryFunction<this>): Pick<this, P>;

  update <T extends this> (entries: Partial<T>): void;
  update(keys: QueryFunction<this>): void;
  update <K extends keyof this> (keys: K[]): void;

  requestUpdate(strict?: boolean): Promise<string[] | false>;
  requestUpdate(timeout: number): Promise<string[] | false>;
  requestUpdate(cb: (keys: string[]) => void): void;
}