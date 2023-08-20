import { add } from '../model';

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

    async function invoke(...args: any[]){
      if(pending)
        return Promise.reject(
          new Error(`Invoked action ${key} but one is already active.`)
        )

      pending = true;
      control.set(key);

      try {
        return await attempt(() => task.apply(control.subject, args))
      }
      finally {
        pending = false;
        control.set(key);
      }
    }

    Object.defineProperty(invoke, "active", {
      get: () => pending
    })

    return {
      value: invoke,
      set: false
    };
  })
}

export { run }

export function attempt(fn: () => any): any {
  function retry(err: unknown){
    if(err instanceof Promise)
      return err.then(compute);
    else
      throw err;
  }

  function compute(): any {
    try {
      const output = fn();

      return output instanceof Promise
        ? output.catch(retry)
        : output;
    }
    catch(err){
      return retry(err);
    }
  }

  return compute();
}