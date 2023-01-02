import { Control } from "../control";
import { Oops } from "./get";

export function factoryMode<T>(
  self: Control,
  output: Promise<T> | T,
  key: string,
  required: boolean
){
  const { subject, state } = self;

  let pending: Promise<any> | undefined;
  let error: any;

  if(output instanceof Promise){
    state.set(key, undefined);

    pending = output
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

  state.set(key, output);

  const suspend = () => {
    if(required === false)
      return undefined;

    const issue =
      Oops.NotReady(subject, key);

    Object.assign(pending!, {
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