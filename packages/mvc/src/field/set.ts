import { listener, capture, observer } from '../observable';
import { event, Model } from '../model';
import { access, compute, update } from '../store';
import { def } from './def';

declare namespace set {
  /**
   * Runs on each assignment with `(next, previous)` - throw `false` to reject, `true` to skip the event.
   *
   * Any other throw propagates to the assigner, value unchanged. A returned function runs on the next
   * assignment, with the new value. Effects created inside are released on the next assignment. Other
   * return values, promises and `false` included, are ignored. `this` is not the instance - use an
   * arrow function.
   */
  type Callback<T, S = any> = (
    this: S,
    next: T,
    previous: T
  ) => ((next: T) => void) | Promise<any> | void | boolean;

  /** Factory initializer - `this` is the instance. A declared parameter makes it a computed instead. */
  type Factory<T, S = any> = (this: S, property: string) => Promise<T> | T;
}

/**
 * Required field with no initial value - reads suspend until it is assigned.
 *
 * Writable and non-enumerable. A read before assignment throws a Promise that is also
 * Error-shaped (`<instance>.<key> is not yet available.`) - it resolves on assignment and
 * rejects if the instance is destroyed. `onUpdate` runs on each assignment - see {@link set.Callback}.
 */
function set<T>(value?: undefined, onUpdate?: set.Callback<T>): T;

/**
 * Value from a factory, run once - lazily on first read, or on activation if `required` is `true`.
 *
 * Read-only and non-enumerable. `this` is the instance. The factory must declare no parameters -
 * one parameter makes it a computed. An async result suspends reads until resolved; a rejection
 * rethrows on later reads. A factory that suspends on another pending field re-runs once it
 * resolves. A synchronous throw warns and rethrows - a lazy factory retries on the next read.
 *
 * @example
 * config = set(() => loadConfig());
 * user = set(async () => api.user(), true);
 */
function set<T>(factory: () => T | Promise<T>, required?: true): T;

/**
 * Lazy factory - with `false`, reads `undefined` while pending instead of suspending.
 *
 * Read-only and non-enumerable. Runs on first read. The field updates when the result resolves.
 * Passing `true` behaves as the required overload.
 */
function set<T>(
  factory: () => T | Promise<T>,
  required: boolean
): T | undefined;

/**
 * Writable field seeded by a factory on activation - `onUpdate` runs for the seed and each assignment.
 *
 * Non-enumerable. The factory runs on activation, not on first read. Its result is assigned through
 * `onUpdate` with `previous` undefined. An async result suspends reads until resolved, then
 * overwrites any value assigned meanwhile. See {@link set.Callback}.
 */
function set<T>(factory: () => T | Promise<T>, onUpdate: set.Callback<T>): T;

/**
 * Computed field - re-derives when a managed property it reads updates; the instruction form of a getter.
 *
 * Arity selects this form - the function must declare a parameter; `set(() => x)` is a one-shot
 * factory. Receives the instance as `this` and first argument - arrow functions work. Computes on
 * first read. Enumerable and read-only, like a getter. A subclass may narrow its type with `declare`,
 * which a getter does not allow. A throw on first compute warns and rethrows; later throws report to
 * `catch` as `getter`.
 *
 * @example
 * class Person extends Model {
 *   first = 'John';
 *   last = 'Doe';
 *   full = set((self: Person) => `${self.first} ${self.last}`);
 * }
 */
function set<T, S = any>(compute: (this: S, self: S) => T): T;

// TODO: if onUpdate is not defined, should this have behavior unique to simple assignment?
// I'm thinking default behavior should be to assign value directly to property, without triggering any additional updates.
// All this requires is a default callback which throws true, silent updates are already implemented.
/**
 * Writable default, hidden from enumeration - unlike plain assignment.
 *
 * Non-enumerable - excluded from `Object.keys`, spread and `ref(this)`; still in `get()` snapshots.
 * A Promise throws a TypeError on activation - pass a factory. A function is taken as a factory
 * or computed, never stored. `onUpdate` runs on each assignment - see {@link set.Callback}.
 *
 * @example
 * name = set('', (next) => {
 *   if (next.length > 50) throw false;
 * });
 */
function set<T>(
  value: T extends Promise<any> ? never : T,
  onUpdate?: set.Callback<T>
): T;

function set<T = any>(value?: unknown, argument?: unknown): any {
  return def<T>((key, subject) => {
    if (value instanceof Promise)
      throw new TypeError(
        `Direct promises are not supported in set(${subject}.${key}). Use set(() => promise) instead.`
      );

    if (typeof value == 'function' && value.length > 0) {
      compute(subject, key, value as () => unknown);
      return;
    }

    const config: Model.Apply = {
      enumerable: false,
      set: false
    };

    let computed = false;

    // One-shot factory
    if (typeof value == 'function') {
      const factory = value.bind(subject, key)
      computed = true;

      function init() {
        let output: unknown;

        try {
          output = attempt(factory);
        } catch (err) {
          console.warn(
            `Generating initial value for ${subject}.${key} failed.`
          );
          throw err;
        }

        config.get = argument !== false;

        function assign(next: any, silent?: boolean) {
          if (typeof argument == 'function') subject[key] = next;
          else update(subject, key, next, silent, true);
        }

        if (output instanceof Promise)
          output.then((next) => {
            if (observer(subject) !== null) assign(next);
          }, (error) => {
            if (observer(subject) === null) return;
            event(subject, key);
            config.get = () => {
              throw error;
            };
          });
        else assign(output, true);

        if (argument) return null;

        if (output instanceof Promise && argument !== false)
          return access(subject, key, true);

        return subject[key];
      }

      if (argument) {
        listener(subject, () => {
          init();
          return null;
        });
      } else {
        config.get = init;
      }
    } else if (value !== undefined) {
      config.value = value;
    }

    if (typeof argument == 'function') {
      let unset: ((next: T) => void) | undefined;

      config.set = function (this: any, value: any, previous: any) {
        capture((release) => {
          const returns = argument.call(this, value, previous);

          if (unset) unset(value);

          unset = (next: T) => {
            if (typeof returns == 'function') returns(next);
            release();
          };
        });
      };
    } else if (!computed)
      config.set = () => {
        config.get = undefined;
        config.set = undefined;
      };

    return config;
  });
}

function attempt(fn: () => any): any {
  function retry(err: unknown) {
    if (err instanceof Promise) return err.then(compute);
    else throw err;
  }

  function compute(): any {
    try {
      const output = fn();

      return output instanceof Promise ? output.catch(retry) : output;
    } catch (err) {
      return retry(err);
    }
  }

  return compute();
}

export { set };
