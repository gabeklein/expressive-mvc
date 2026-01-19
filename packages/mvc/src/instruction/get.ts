import { enter } from '../control';
import { Context } from '../context';
import { State, PARENT, update } from '../state';
import { use } from './use';

type Type<T extends State> = State.Extends<T> & typeof State;

const APPLY = new WeakMap<
  State,
  (state: State, child: boolean) => (() => void) | boolean | void
>();

declare namespace get {
  type Effect<T> = (state: T, key: string) => (() => void) | void;
  type Callback<T = any> = (
    state: T,
    child: boolean
  ) => void | boolean | (() => void);
}

/**
 * Recipient mode: setup callback to be invoked when child states request this instance from context.
 *
 * @param callback - Called when a child requests this state, with the requesting state and child=true
 */
function get(callback?: get.Callback<State>): readonly State[];

/**
 * Fetches and assigns the controller which spawned this host.
 * When parent assigns an instance via `use()` directive, it
 * will be made available to child upon this request.
 *
 * @param Type - Type of controller compatible with this class.
 * @param asParent - If true, will throw if State is created without a parent.
 */
function get<T extends State>(Type: State.Extends<T>, asParent?: true): T;

/**
 * Fetches and assigns the controller which spawned this host.
 * When parent assigns an instance via `use()` directive, it
 * will be made available to child upon this request.
 *
 * @param Type - Type of controller compatible with this class.
 * @param required - If false, property may be undefined. Otherwise will throw suspense.
 */
function get<T extends State>(
  Type: State.Extends<T>,
  required?: false
): T | undefined;

/**
 * Bidirectional search: fetch states from parent context and collect child states
 * that request this type from context.
 *
 * @param Type - Type of State to search for
 * @param callback - Called for each state found, with child=false for parents, child=true for children
 */
function get<T extends State>(
  Type: State.Extends<T>,
  callback: get.Callback<T>
): readonly T[];

function get<R, T extends State>(
  arg0?: Type<T> | get.Callback<State>,
  arg1?: get.Callback<T> | boolean
) {
  // Recipient mode: no type provided or first arg is callback
  if (!arg0 || typeof arg0 === 'function') {
    return use<State[]>((key, subject) => {
      const applied = new Set<State>();
      const reset = () => {
        update(subject, key, Object.freeze(Array.from(applied)));
      };

      if (APPLY.has(subject))
        throw new Error(`'get' callback can only be used once per state.`);

      APPLY.set(subject, (requester, child) => {
        let remove: (() => void) | boolean | void;

        if (arg0) {
          remove = (arg0 as get.Callback<State>)(requester, child);
          if (remove === false) return false;
        }

        applied.add(requester);
        reset();

        return () => {
          applied.delete(requester);
          reset();

          if (typeof remove == 'function') remove();
        };
      });

      return {
        value: [],
        enumerable: false
      };
    });
  }

  // Bidirectional mode: type + callback
  if (typeof arg1 === 'function') {
    console.log('Bidirectional mode activated for type:', (arg0 as any).name);
    return use<T[]>((key, subject) => {
      console.log('Bidirectional use callback called, key:', key, 'subject:', subject.constructor.name);
      const applied = new Set<T>();
      const reset = () => {
        update(subject, key, Object.freeze(Array.from(applied)));
      };

      // Set up recipient mode to catch children searching up
      if (APPLY.has(subject))
        throw new Error(`'get' callback can only be used once per state.`);

      APPLY.set(subject, (requester, child) => {
        console.log('APPLY called on', subject.constructor.name, 'by', requester.constructor.name, 'child:', child);
        let remove: (() => void) | boolean | void;

        remove = (arg1 as get.Callback<T>)(requester as T, true);
        if (remove === false) return false;

        applied.add(requester as T);
        reset();

        return () => {
          applied.delete(requester as T);
          reset();

          if (typeof remove == 'function') remove();
        };
      });

      // Search upward for parent states
      Context.get(subject, (context) => {
        console.log('Bidirectional: got context for', subject.constructor.name);
        context.get(arg0, (state: T) => {
          console.log('Bidirectional: context.get callback called for', state.constructor.name);
          let remove: (() => void) | undefined;
          let disconnect: (() => void) | undefined;
          let flush: (() => void) | undefined;

          if (applied.has(state)) return;

          const exit = enter();

          try {
            const notify = APPLY.get(state as State);

            if (notify) {
              const after = notify(subject as State, true);

              if (after === false) return;
              if (typeof after == 'function') disconnect = after;
            }

            const done = (arg1 as get.Callback<T>)(state, false);

            if (done === false) return false;
            if (typeof done == 'function') remove = done;
          } finally {
            flush = exit();
          }

          applied.add(state);
          reset();

          const done = () => {
            flush();
            ignore();

            applied.delete(state);
            reset();

            if (disconnect) disconnect();
            if (typeof remove == 'function') remove();

            remove = undefined;
          };

          const ignore = (state as State).set(done, null);

          return done;
        });
      });

      return {
        value: [],
        enumerable: false
      };
    });
  }

  // Single parent mode: type + boolean/undefined
  return use((key, subject) => {
    const hasParent = PARENT.get(subject) as T;

    function assign(value: T) {
      // Notify parent's APPLY callback if it exists (for bidirectional/recipient mode)
      const notify = APPLY.get(value as State);
      if (notify) {
        notify(subject as State, true);
      }

      update(subject, key, value);
    }

    if (!hasParent && arg1 === true)
      throw new Error(`${subject} may only exist as a child of type ${arg0}.`);
    else if (hasParent)
      if (hasParent instanceof arg0) {
        assign(hasParent);
        return {};
      } else if (arg1 === true)
        throw new Error(
          `New ${subject} created as child of ${hasParent}, but must be instanceof ${arg0}.`
        );

    Context.get(subject, (context) => {
      const self = context.get(arg0) as T | undefined;

      if (self) assign(self);
      else if (arg1 !== false)
        throw new Error(
          `Required ${arg0} not found in context for ${subject}.`
        );
    });

    return {
      get: arg1 !== false,
      enumerable: false
    };
  });
}

export { get };
