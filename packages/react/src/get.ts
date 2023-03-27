import { get, Internal, issues, Model, Register } from '@expressive/mvc';

import { useLookup } from './useContext';

export const Oops = issues({
  AmbientRequired: (requested, requester) =>
    `Attempted to find an instance of ${requested} in context. It is required by ${requester}, but one could not be found.`
});

const Pending = new WeakMap<{}, ((context: Register) => void)[]>();
const Applied = new WeakMap<Model, boolean>();

function getForGetInstruction<T extends Model>(
  type: Model.Class<T>,
  from: Model,
  required: boolean
){
  return (callback: (got: T) => void) => {
    const item = Internal.getParent(from, type);

    if(item)
      callback(item);
    else
      getPending(from).push(context => {
        const got = context.get<T>(type);

        if(got)
          callback(got);
        else if(required)
          throw Oops.AmbientRequired(type, from);
      })
  }
}

function usePeerContext(subject: Model){
  if(Applied.has(subject)){
    if(Applied.get(subject))
      useLookup();

    return;
  }

  const pending = Pending.get(subject);

  if(pending){
    const local = useLookup();

    for(const init of pending)
      init(local);

    Pending.delete(subject);
  }

  Applied.set(subject, !!pending);
}

function getPending(subject: {}){
  let pending = Pending.get(subject);

  if(!pending)
    Pending.set(subject, pending = []);

  return pending;
}

const instruction = get.using(getForGetInstruction);

export {
  instruction as get,
  usePeerContext,
  getPending
}