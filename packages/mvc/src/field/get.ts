import { capture, listener, observer } from '../observable';
import { Context, within } from '../context';
import { Model, children, owned, parent, STORE, update } from '../state';
import type { Got, Keyed } from '../state';
import { def } from './def';

declare namespace get {
  type Callback<T = any> = (
    state: T,
    subject: Model
  ) => void | boolean | (() => void);
}

/**
 * Fetches upstream Model from context with optional lifecycle callback.
 * Callback runs on mount and can return cleanup function for unmount.
 *
 * @param Type - Type of Model to fetch.
 * @param callback - Optional lifecycle callback, receives (state, subject). Can return cleanup function.
 */
function get<T extends Model>(
  Type: Model.Extends<T>,
  callback?: get.Callback<T>
): T;

/**
 * Fetches and assigns the controller which spawned this host.
 *
 * @param Type - Type of controller compatible with this class.
 * @param required - If false, property may be undefined. Otherwise will throw.
 */
function get<T extends Model>(
  Type: Model.Extends<T>,
  required: false
): T | undefined;

/**
 * Collects downstream Models, accumulating all instances of specified type
 * for which this is an ancestor. Returns an array that updates as Models
 * are added or removed. Callback runs on each registration and can return
 * cleanup or false to prevent registration.
 *
 * @param Type - Type of Model to collect.
 * @param downstream - Must be true to enable downstream mode.
 * @param callback - Optional lifecycle callback, receives (state, subject). May return false to prevent registration.
 */
function get<T extends Model>(
  Type: Model.Extends<T>,
  downstream: true,
  callback?: get.Callback<T>
): T[];

/**
 * Fetches a single downstream Model of specified type.
 * Updates when a matching child appears or is removed.
 * Throws if not found.
 *
 * @param Type - Type of Model to fetch.
 * @param downstream - Must be true to enable downstream mode.
 * @param required - Throw if no match found.
 */
function get<T extends Model>(
  Type: Model.Extends<T>,
  downstream: true,
  single: true
): T;

/**
 * Fetches a single downstream Model of specified type.
 * Updates when a matching child appears or is removed.
 * Returns undefined if not found.
 *
 * @param Type - Type of Model to fetch.
 * @param downstream - Must be true to enable downstream mode.
 * @param required - If false, returns undefined if no match found.
 */
function get<T extends Model>(
  Type: Model.Extends<T>,
  downstream: true,
  required: false
): T | undefined;

/**
 * Fetches through `Type.get(...args)` once this Model is ready, with this Model
 * as origin. Applies where the first argument is neither boolean nor function -
 * a key for a class overriding static `get`.
 *
 * @param Type - Class to fetch from.
 * @param args - Arguments for `Type.get`.
 */
function get<C extends Model.Extends>(
  Type: C,
  ...args: Keyed<C>
): Got<C>;

function get<T extends Model>(
  Type: Model.Extends<T>,
  arg1?: any,
  ...args: any[]
): any {
  if (arg1 === true) return below(Type, args[0]);

  if (arg1 === undefined || typeof arg1 == 'boolean' || typeof arg1 == 'function')
    return above(Type, arg1);

  return def((key, subject) => {
    listener(subject, () => {
      update(subject, key, within(subject, () => (Type.get as Function)(arg1, ...args)));
      return null;
    }, true);

    return {
      get: true,
      enumerable: false
    };
  });
}

function above<T extends Model>(
  Type: Model.Extends<T>,
  argument: get.Callback<T> | boolean | undefined
) {
  return def<T>((key, subject) => {
    const hasParent = parent(subject);
    const callback =
      typeof argument === 'function'
        ? (argument as get.Callback<T>)
        : undefined;

    function assign(value: T) {
      if (STORE.get(subject)![key] === value) return;

      if (callback) {
        const result = callback(value, subject);
        if (typeof result === 'function') subject.set(null, result);
      }
      update(subject, key, value);
    }

    if (hasParent && hasParent instanceof Type) {
      assign(hasParent as T);
      return {};
    }

    if (Type === Model) {
      if (argument === false) return { get: false, enumerable: false };
      throw new Error(`${subject} has no owner.`);
    }

    let found = false;
    let depth = Infinity;
    let level = 0;

    for (let p: Model | null | undefined = hasParent; p; p = parent(p), level++) {
      const at = level;

      if (p instanceof Type) {
        if (!found) {
          found = true;
          depth = at;
          assign(p as T);
        }
        break;
      }

      const remove = children(p, (child) => {
        if (child !== subject && child instanceof Type && at <= depth) {
          found = true;
          depth = at;
          assign(child as T);
        }
      });

      subject.set(null, () => { remove(); });
    }

    if (!found) {
      const remove = Context.get(subject).get(Type, (state) => {
        if (depth !== Infinity) return;
        found = true;
        assign(state);
      }, false, subject) as () => void;

      subject.set(null, () => { remove(); });
    }

    if (!found && argument !== false) {
      const missing = () =>
        new Error(`Required ${Type} not found in context for ${subject}.`);

      let activating: Model | undefined;

      for (
        let p: Model | null | undefined = hasParent;
        p && !observer(p)!.ready;
        p = parent(p)
      )
        activating = p;

      if (!activating) throw missing();

      listener(activating, () => {
        if (!found) throw missing();
        return null;
      }, true);
    }

    return {
      get: argument !== false,
      enumerable: false
    };
  });
}

function below<T extends Model>(
  Type: Model.Extends<T>,
  arg: get.Callback<T> | boolean | undefined
) {
  return def<T[]>((key, subject) => {
    const context = Context.get(subject);
    const watch = (callback: (state: T) => (() => void) | void) =>
      Type === Model
        ? owned(subject, callback as (state: Model) => (() => void) | void)
        : context.get(Type, callback, true);

    if (typeof arg == 'boolean') {
      watch(
        (state) => {
          update(subject, key, state);
          return state.set(null, () => {
            update(subject, key, undefined);
          });
        }
      );

      return {
        get: arg,
        value: undefined,
        enumerable: false
      };
    }

    const applied = new Set<Model>();

    watch(
      (state) => {
        let remove: (() => void) | undefined;
        let release: (() => void) | undefined;

        if (applied.has(state)) return;

        if (arg) {
          let rejected = false;

          capture((fn) => {
            const done = arg(state, subject);

            if (done === false) rejected = true;
            else if (typeof done == 'function') remove = done;

            release = fn;
          });

          if (rejected) return;
        }

        applied.add(state);
        update(subject, key, [...applied]);

        function done() {
          if (release) release();
          ignore();

          applied.delete(state);
          update(subject, key, [...applied]);

          if (typeof remove == 'function') remove();
        }

        const ignore = state.set(null, done);

        return done;
      }
    );

    return {
      value: [],
      enumerable: false
    };
  });
}

export { get };
