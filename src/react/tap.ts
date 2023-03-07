import { getParent } from '../children';
import { issues } from '../helper/issues';
import { Model } from '../model';
import { Lookup, useLookup } from './context';
import { MVC } from './mvc';

export const Oops = issues({
  NotAllowed: (parent, child) =>
    `Global '${parent}' attempted to attach '${child}' but it is not also a singleton.`,

  AmbientRequired: (requested, requester) =>
    `Attempted to find an instance of ${requested} in context. It is required by ${requester}, but one could not be found.`
})

const Pending = new WeakMap<{}, ((context: Lookup) => void)[]>();
const Applied = new WeakMap<Model, boolean>();

function getContextForGetInstruction<T extends Model>(
  type: Model.Type<T>,
  relativeTo: Model,
  required: boolean
){
  let item = getParent(type, relativeTo);

  return (refresh: (x: T) => void) => {
    if(item)
      return item;

    findRelative(relativeTo, type, got => {
      if(got){
        item = got;
        refresh(got);
      }
      else if(required)
        throw Oops.AmbientRequired(type.name, relativeTo);
    })
  }
}

function findRelative<T extends Model>(
  from: Model,
  type: Model.Type<T>,
  callback: (got: T | undefined) => void){

  if(MVC.isTypeof(type) && type.global)
    callback(type.get());
  else if((from as any).constructor.global)
    throw Oops.NotAllowed(from, type.name)
  else
    getPending(from).push(context => {
      callback(context.get<T>(type));
    })
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

export {
  getContextForGetInstruction,
  usePeerContext,
  getPending
}