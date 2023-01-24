import { Control } from '../control';
import { issues } from '../helper/issues';
import { assign } from '../helper/object';

export const Oops = issues({
  NotReady: (model, key) =>
    `Value ${model}.${key} value is not yet available.`
});

export function factoryMode<T>(
  self: Control,
  value: Promise<T> | T,
  key: string,
  required: boolean
){
  const { subject, state } = self;

  let pending: Promise<any> | undefined;
  let error: any;

  if(value instanceof Promise){
    state.set(key, undefined);

    pending = value
      .catch(err => error = err)
      .then(val => {
        state.set(key, val);
        return val;
      })
      .finally(() => {
        pending = undefined;
        self.update(key);
      })
  }
  else
    state.set(key, value);

  const suspend = () => {
    if(required === false)
      return undefined;

    const issue = Oops.NotReady(subject, key);

    assign(pending!, {
      message: issue.message,
      stack: issue.stack
    });

    throw pending;
  }
  
  return (): T | undefined => {
    if(error)
      throw error;

    if(pending)
      return suspend();

    if(state.has(key))
      return state.get(key);
  }
}