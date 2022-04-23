import { control } from '../controller';
import { issues } from '../issues';
import { Model } from '../model';
import { defineProperty, getOwnPropertyDescriptors } from '../util';
import { child } from './child';
import { Parent } from './parent';

export const Oops = issues({
  BadArgument: (type) =>
    `Instruction \`use\` cannot accept argument type of ${type}.`,
})

function bootstrap<T extends {}>(object: T){
  const breakdown = getOwnPropertyDescriptors(object);
  const control = new Model();

  for(const key in breakdown)
    defineProperty(control, key, breakdown[key]);
    
  return control as T & Model;
}

/**
 * Create a placeholder for specified Model type.
 */
function use <T extends Model> (): T | undefined;

 /**
  * Create a new child instance of model.
  */
function use <T extends Class> (Type: T, callback?: (i: InstanceOf<T>) => void): InstanceOf<T>;
 
 /**
  * Create a new child-instance from factory function.
  */
function use <T extends Model> (from: () => T, callback?: (i: T) => void): T;
 
 /**
  * Create child-instance relationship with provided model.
  *
  * Note: If `peer` is not already initialized before parent is
  * (created with `new` as opposed to create method), that model will
  * attach this via `parent()` instruction. It will not, if
  * already active.
  */
function use <T extends Model> (peer: T, callback?: (i: T) => void): T;
 
 /**
  * Generate a child controller from specified object. Object's values are be trackable, as would be for a full-model.
  *
  * Note: Child will *not* be same object as one provided.
  */
function use <T extends {}> (object: T): T;

function use<T extends typeof Model>(
  input?: T | (() => InstanceOf<T>),
  argument?: (i: InstanceOf<T> | undefined) => void){

  return child(
    function use(key){
      const { subject } = this;

      let current: Model | undefined;
  
      const onUpdate = (
        next: Model | {} | undefined) => {

        if(next){
          current = next instanceof Model
            ? next : bootstrap(next);

          Parent.set(current, subject);
          control(current);
        }
        else
          current = undefined;
  
        if(typeof argument == "function")
          return argument(current as InstanceOf<T>);
      }
  
      if(input){
        const initial =
          Model.isTypeof(input)
            ? new input() :
          input instanceof Model
            ? input :
          typeof input === "function"
            ? input() :
          typeof input === "object"
            ? bootstrap(input)
            : null;

        if(initial)
          onUpdate(initial);

        else if(initial === null)
          throw Oops.BadArgument(typeof input);
      }
  
      return {
        get: () => current,
        set: onUpdate
      }
    }
  )
}

export { use }