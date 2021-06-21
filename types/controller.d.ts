import { Model } from './model';
import { Selector } from './selector';
import { Callback, EffectCallback, UpdateCallback } from './types';

type CallbackFor<S extends Selector.Function<any>, T> =
  (this: T, value: Selector.Gets<S>, key: Selector.From<S>) => void;

interface EventDispatch {
  // Explicit all
  on <S extends Model.SelectEvents<this>> (via: S, cb: CallbackFor<S, this>, squash?: false, once?: boolean): Callback;
  on <P extends Model.EventsCompat<this>> (key: P | P[], listener: UpdateCallback<this, P>, squash?: false, once?: boolean): Callback;

  once <S extends Model.SelectEvents<this>> (via: S, cb: CallbackFor<S, this>, squash?: false): Callback;
  once <P extends Model.EventsCompat<this>> (key: P | P[], listener: UpdateCallback<this, P>, squash?: false): Callback;

  // Explicit squash
  on <S extends Model.SelectEvents<this>> (via: S, cb: (keys: Selector.From<S>[]) => void, squash: true, once?: boolean): Callback;
  on <P extends Model.EventsCompat<this>> (key: P | P[], listener: (keys: P[]) => void, squash: true, once?: boolean): Callback;

  once <S extends Model.SelectEvents<this>> (via: S, cb: (keys: Selector.From<S>[]) => void, squash: true): Callback;
  once <P extends Model.EventsCompat<this>> (key: P | P[], listener: (keys: P[]) => void, squash: true): Callback;

  // Implicit squash
  once <S extends Model.SelectEvents<this>> (via: S): Promise<Selector.From<S>[]>;
  once <P extends Model.EventsCompat<this>> (key: P | P[]): Promise<P[]>;

  // Unknown squash
  on <S extends Model.SelectEvents<this>> (via: S, cb: unknown, squash: boolean, once?: boolean): Callback;
  on <P extends Model.EventsCompat<this>> (key: P | P[], listener: unknown, squash: boolean, once?: boolean): Callback;

  once <S extends Model.SelectEvents<this>> (via: S, cb: unknown, squash: boolean): Callback;
  once <P extends Model.EventsCompat<this>> (key: P | P[], listener: unknown, squash: boolean): Callback;
}

/**
 * Observable Instance
 * 
 * Implements internal value tracking. 
 * Able to be subscribed to, per-value to know when updated.
 */
interface Dispatch extends EventDispatch {
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