import { issues } from '../issues';
import { defineProperty, setAlias } from '../util';
import { apply } from './apply';

type Async<T = any> = (...args: any[]) => Promise<T>;

export const Oops = issues({
  DuplicateAction: (key) =>
    `Invoked action ${key} but one is already active.`
})

/**
 * Sets an exotic method with managed ready-state. Property accepts an async function.
 *
 * When an act-method is invoked, its `active` property to true for duration of call.
 * This is emitted as an update to property, both when called and after returns (or throws).
 *
 * **Note:** Subsequent calls will immediately throw if one is still pending.
 *
 * @param action - Action to fire when resulting property is invoked.
 */
function act (action: Async): typeof action & { active: boolean };
function act <S> (action: Async<S>): typeof action & { active: boolean };

function act<T extends Async>(task: T){
  return apply<T>(
    function act(key){
      let pending = false;

      const invoke = (...args: any[]) => {
        if(pending)
          return Promise.reject(
            Oops.DuplicateAction(key)
          )

        pending = true;
        this.update(key);

        return new Promise(res => {
          res(task.apply(this.subject, args));
        }).finally(() => {
          pending = false;
          this.update(key);
        })
      }

      this.state[key] = undefined;

      setAlias(invoke, `run ${key}`);
      defineProperty(invoke, "active", {
        get: () => pending
      })

      return {
        value: invoke as T,
        set: false
      };
    }
  )
}

export { act }