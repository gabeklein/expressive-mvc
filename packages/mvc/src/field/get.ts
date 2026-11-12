import { capture, listener, observer, watch } from '../observable';
import { Context, within } from '../context';
import { Model, children, owned, parent } from '../model';
import { store, update } from '../store';
import type { Got, Keyed } from '../model';
import { def } from './def';

declare namespace get {
  /**
   * Runs as a match is assigned, with the match and the instance holding the field.
   *
   * Return a function to clean up when that match leaves; downstream, return `false` to decline it.
   */
  type Callback<T = any> = (
    state: T,
    subject: Model
  ) => void | boolean | (() => void);
}

/**
 * Nearest upstream instance of a type - owner, then ancestors and their children, then context.
 *
 * Nearest match wins - an ancestor beats a sibling at its own level. Never resolves to itself.
 * A sibling replaced on its ancestor updates the field. A match in the owner tree wins over context,
 * unless a context layer between this instance and the match provides the type.
 * Context is the fallback - a closer provider arriving replaces the value; a provider leaving
 * suspends reads until another arrives. Throws if none resolves by the time the owning tree activates.
 * `get(Model)` is the owner - throws if none.
 * Callback runs per match assigned, not on the match's own updates - a returned function runs when
 * that match is replaced or leaves, or this instance is destroyed. Non-enumerable.
 *
 * @example
 * app = get(App);
 * socket = get(Socket, (socket) => {
 *   socket.join(this);
 *   return () => socket.leave(this);
 * });
 */
function get<T extends Model>(
  Type: Model.Extends<T>,
  callback?: get.Callback<T>
): T;

/**
 * Nearest upstream instance of a type, or `undefined` while there is none - never throws.
 *
 * Resolves as the required form does. A context provider leaving resets the field to `undefined`.
 * `get(Model, false)` is the owner, if any. Non-enumerable.
 */
function get<T extends Model>(
  Type: Model.Extends<T>,
  required: false
): T | undefined;

/**
 * Every instance of a type below this one in context - a new array as they arrive and leave.
 *
 * Subclasses match; superclasses do not. Starts empty. Repeat registrations are ignored.
 * `get(Model, true)` lists instances this one owns directly - not grandchildren or context.
 * Callback runs per arrival with a ready instance - return `false` to skip it, or a function run
 * as it leaves, before either side is destroyed. Effects created in the callback stop then too.
 * Non-enumerable.
 *
 * @param downstream - Collect below instead of looking up.
 * @example
 * items = get(Item, true, (item) => {
 *   if (item.hidden) return false;
 *   return () => console.log('removed', item);
 * });
 */
function get<T extends Model>(
  Type: Model.Extends<T>,
  downstream: true,
  callback?: get.Callback<T>
): T[];

/**
 * One instance of a type below this one in context - reads suspend until it arrives.
 *
 * Updates as a match arrives or is destroyed. Ignores upstream matches.
 * `get(Model, true, true)` is an instance this one owns directly. Non-enumerable.
 *
 * @param downstream - Look below instead of up.
 * @param single - Required single match instead of a list.
 */
function get<T extends Model>(
  Type: Model.Extends<T>,
  downstream: true,
  single: true
): T;

/**
 * One instance of a type below this one in context, or `undefined` while there is none.
 *
 * Updates as a match arrives or is destroyed. Ignores upstream matches.
 * `get(Model, true, false)` is an instance this one owns directly. Non-enumerable.
 *
 * @param downstream - Look below instead of up.
 * @param required - Optional single match instead of a list.
 */
function get<T extends Model>(
  Type: Model.Extends<T>,
  downstream: true,
  required: false
): T | undefined;

/**
 * Value of `Type.get(...args)`, fetched as the field is defined with this instance as origin.
 *
 * For a class overriding static `get` - applies when the first argument is neither boolean nor
 * function; arguments must match the override. Resolves once, before `new()` - never reassigned.
 * A thrown Promise suspends reads and retries once settled; an Error throws from construction.
 * The result is not adopted. Non-enumerable.
 *
 * @example
 * buyer = get(User, 5);
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
    const resolve = () => update(subject, key, within(subject, () => (Type.get as Function)(arg1, ...args)));

    try {
      resolve();
    } catch (error) {
      if (!(error instanceof Promise)) throw error;

      watch(subject, () => {
        resolve();
        return null;
      });
    }

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

    let release: (() => void) | undefined;

    function assign(value: T | undefined) {
      if (store(subject)[key] === value) return;

      if (release) release();

      const result = callback && value && callback(value, subject);

      release = typeof result === 'function' ? result : undefined;
      update(subject, key, value);
    }

    if (callback)
      subject.set(null, () => release?.());

    if (hasParent && hasParent instanceof Type && !nearer(subject, hasParent, Type)) {
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
        if (!found && !nearer(subject, p, Type)) {
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

    if (!found)
      subject.set(null, watch(Context.get(subject), (ctx) => {
        if (depth !== Infinity) return null;

        const state = ctx.get(Type, false, undefined, subject);

        if (state) {
          found = true;
          assign(state as T);
        } else if (found) assign(undefined);
      }, false));

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

function nearer(subject: Model, owner: Model, Type: Model.Extends) {
  const stop = Context.get(owner);

  for (let ctx: Context | undefined = Context.get(subject); ctx && ctx !== stop; ctx = ctx.parent)
    if (ctx.provide.get(Type)?.size) return true;

  return false;
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
