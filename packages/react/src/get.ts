import { issues, Model, Context } from '@expressive/mvc';

import { useAmbient } from './provider';

export const Oops = issues({
  AmbientRequired: (requested, requester) =>
    `Attempted to find an instance of ${requested} in context. It is required by ${requester}, but one could not be found.`
});

const Pending = new WeakMap<{}, ((context: Context) => void)[]>();
const Applied = new WeakMap<Model, boolean>();

export function hasContext<T extends Model>(
  this: Model.Type<T>,
  callback: (got: T) => void,
  required?: boolean | undefined,
  relativeTo?: Model
){
  if(!relativeTo){
    const got = useAmbient().get(this, required);
  
    if(callback && got)
      callback(got);

    return;
  }

  let pending = Pending.get(relativeTo);
  
  if(!pending)
    Pending.set(relativeTo, pending = []);

  pending.push(context => {
    const got = context.get<T>(this, false);

    if(got)
      callback(got);
    else if(required)
      throw Oops.AmbientRequired(this, relativeTo);
  })
}

export function usePeerContext(subject: Model){
  if(Applied.has(subject)){
    if(Applied.get(subject))
      useAmbient();

    return;
  }

  const pending = Pending.get(subject);

  if(pending){
    const local = useAmbient();

    for(const init of pending)
      init(local);

    Pending.delete(subject);
  }

  Applied.set(subject, !!pending);
}

export function setPeers(context: Context, onto: Model){
  const pending = Pending.get(onto);

  if(pending)
    pending.forEach(cb => cb(context));
}