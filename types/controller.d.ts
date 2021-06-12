import { Model } from './model';
import { Selector } from './selector';

type IfApplicable<T extends {}, K> = K extends keyof T ? T[K] : undefined;
type UpdateCallback<T, P, V> = (this: T, value: V, changed: P) => void;
type CallbackFor<S extends Selector.Function<any>, T> = (this: T, value: Selector.Gets<S>, key: Selector.From<S>) => void

/**
 * Observable Instance
 * 
 * Implements internal value tracking. 
 * Able to be subscribed to, per-value to know when updated.
 */
interface Dispatch {
  on <S extends Model.SelectEvents<this>> (via: S, cb: CallbackFor<S, this>): Callback;
  on <P extends Model.EventsCompat<this>> (property: P | P[], listener: UpdateCallback<this, P, IfApplicable<this, P>>): Callback;

  once <S extends Model.SelectEvents<this>> (via: S): Promise<void>;
  once <S extends Model.SelectEvents<this>> (via: S, cb: CallbackFor<S, this>): Callback;
  once <P extends Model.EventsCompat<this>> (property: P | P[]): Promise<void>;
  once <P extends Model.EventsCompat<this>> (property: P | P[], listener: UpdateCallback<this, P, IfApplicable<this, P>>): void;

  effect(callback: EffectCallback<this>, select?: Model.SelectFields<this>): Callback;
  effect(callback: EffectCallback<this>, select?: (keyof this)[]): Callback;

  import <O extends Model.Data<this>> (via: O, select?: string[] | Model.SelectFields<this>): void;

  export(): Model.Entries<this>;
  export <P extends Model.Fields<this>> (select: P[]): Pick<this, P>;
  export <S extends Model.SelectFields<this>> (select: S): Pick<this, Selector.From<S>>;

  update(keys: Model.SelectFields<this>): void;
  update(keys: Model.Fields<this>[]): void;

  requestUpdate(strict?: boolean): Promise<string[] | false>;
  requestUpdate(cb: (keys: string[]) => void): void;
}

export = Dispatch;