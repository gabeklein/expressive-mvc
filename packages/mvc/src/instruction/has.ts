import { enter } from '../control';
import { Context } from '../context';
import { State, update } from '../state';
import { use } from './use';

const APPLY = new WeakMap<
  State,
  (state: State) => (() => void) | boolean | void
>();

declare namespace has {
  type Callback<T = any> = (
    state: T,
    recipient: State
  ) => void | boolean | (() => void);
}

function has<T extends State>(
  type: State.Extends<T>,
  callback?: has.Callback<T>
): readonly T[];
function has(callback?: has.Callback): readonly State[];

function has<T extends State>(
  arg1?: State.Extends<T> | has.Callback<State>,
  arg2?: has.Callback<T>
) {
  return use<T[]>((key, subject) => {
    const applied = new Set<State>();
    const reset = () => {
      update(subject, key, Object.freeze(Array.from(applied)));
    };

    if (State.is(arg1))
      Context.get(subject, (context) => {
        context.get(arg1, (state) => {
          let remove: (() => void) | undefined;
          let disconnect: (() => void) | undefined;
          let flush: (() => void) | undefined;

          if (applied.has(state)) return;

          const exit = enter();

          try {
            const notify = APPLY.get(state);

            if (notify) {
              const after = notify(subject);

              if (after === false) return;
              if (typeof after == 'function') disconnect = after;
            }

            if (typeof arg2 == 'function') {
              const done = arg2(state, subject);

              if (done === false) return false;
              if (typeof done == 'function') remove = done;
            }
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

          const ignore = state.set(done, null);

          return done;
        });
      });
    else {
      if (APPLY.has(subject))
        throw new Error(`'has' callback can only be used once per state.`);

      APPLY.set(subject, (recipient) => {
        let remove: (() => void) | boolean | void;

        if (arg1) {
          remove = arg1(recipient, subject);
          if (remove === false) return false;
        }

        applied.add(recipient);
        reset();

        return () => {
          applied.delete(recipient);
          reset();

          if (typeof remove == 'function') remove();
        };
      });
    }

    return {
      value: [],
      enumerable: false
    };
  });
}

export { has };
