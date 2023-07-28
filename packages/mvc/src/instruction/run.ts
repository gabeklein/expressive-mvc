import { add } from '../control';
import { issues } from '../helper/issues';
import { define } from '../helper/object';
import { mayRetry } from '../suspense';

type Async<T = any> = (...args: any[]) => Promise<T>;

export const Oops = issues({
  DuplicatePending: (key) =>
    `Invoked action ${key} but one is already active.`
})

/**
 * Sets an exotic method with managed ready-state. Property accepts an async function.
 *
 * When a run-method is invoked, its `active` property to true for duration of call.
 * This is emitted as an update to property, both when called and after returns (or throws).
 *
 * **Note:** Subsequent calls will immediately throw if one is still pending.
 *
 * @param action - Action to fire when resulting property is invoked.
 */
function run (action: Async): typeof action & { active: boolean };
function run <S> (action: Async<S>): typeof action & { active: boolean };

function run<T extends Async>(task: T){
  return add<T>((key, control) => {
    let pending = false;

    const invoke = async (...args: any[]) => {
      if(pending)
        return Promise.reject(
          Oops.DuplicatePending(key)
        )

      pending = true;
      control.update(key);

      try {
        return await mayRetry(() => task.apply(control.subject, args))
      }
      finally {
        pending = false;
        control.update(key);
      }
    }

    control.state[key] = undefined;

    define(invoke, "active", {
      get: () => pending
    })

    return {
      value: invoke as T,
      set: false
    };
  })
}

export { run }