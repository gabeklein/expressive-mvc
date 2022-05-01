import { control } from '../controller';
import { issues } from '../issues';
import { Model } from '../model';
import { Class, InstanceOf } from '../types';
import { defineProperty, getOwnPropertyDescriptors } from '../util';
import { child } from './child';
import { Parent } from './parent';

export const Oops = issues({
  BadArgument: (type) =>
    `Instruction \`use\` cannot accept argument type of ${type}.`,
})

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
  
      const onUpdate = (next: Model | {} | undefined) => {
        let value: Model | undefined;

        if(next){
          value = next instanceof Model
            ? next : bootstrap(next);

          Parent.set(value, subject);
          control(value);
        }

        this.state[key] = value;
  
        if(typeof argument == "function")
          argument(value as InstanceOf<T>);

        return true;
      }
  
      if(input){
        const value =
          Model.isTypeof(input)
            ? new input() :
          input instanceof Model
            ? input :
          typeof input === "function"
            ? input() :
          typeof input === "object"
            ? bootstrap(input)
            : null;

        if(value === null)
          throw Oops.BadArgument(typeof input);

        if(value)
          onUpdate(value);
      }
  
      return onUpdate;
    }
  )
}

function bootstrap<T extends {}>(object: T){
  const breakdown = getOwnPropertyDescriptors(object);
  const control = new Model();

  for(const key in breakdown)
    defineProperty(control, key, breakdown[key]);
    
  return control as T & Model;
}

export { use }