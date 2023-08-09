import { add } from '../control';
import { define } from '../helper/object';
import { attempt } from '../observe';

type Async<T = any, Y extends any[] = any> = {
  (...args: Y): Promise<T>;
  active: boolean
};

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
function run <T, Y extends any[]> (action: (...args: Y) => T | Promise<T>): Async<T, Y>;

function run(task: Function){
  return add((key, control) => {
    let pending = false;

    const invoke = async (...args: any[]) => {
      if(pending)
        return Promise.reject(
          new Error(`Invoked action ${key} but one is already active.`)
        )

      pending = true;
      control.update(key);

      try {
        return await attempt(() => task.apply(control.subject, args))
      }
      finally {
        pending = false;
        control.update(key);
      }
    }

    define(invoke, "active", {
      get: () => pending
    })

    return {
      value: invoke,
      set: false
    };
  })
}

export { run }