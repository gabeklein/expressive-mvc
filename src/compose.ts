import { child } from './attach';
import { manage, set } from './controller';
import { issues } from './issues';
import { Model } from './model';
import { defineProperty, getOwnPropertyDescriptors } from './util';

const Parent = new WeakMap<{}, {}>();

export const Oops = issues({
  ParentRequired: (expects, child) => 
    `New ${child} created standalone but requires parent of type ${expects}. Did you remember to create via use(${child})?`,

  UnexpectedParent: (expects, child, got) =>
    `New ${child} created as child of ${got}, but must be instanceof ${expects}.`,

  UndefinedNotAllowed: (key) =>
    `Child property ${key} may not be undefined.`,

  BadArgument: (type) =>
    `Instruction \`use\` cannot accept argument type of ${type}.`
})

function bootstrap<T extends {}>(object: T){
  const breakdown = getOwnPropertyDescriptors(object);
  const control = new Model();

  for(const key in breakdown)
    defineProperty(control, key, breakdown[key]);
    
  return control as T & Model;
}

export function use<T extends typeof Model>(
  input?: T | (() => InstanceOf<T>),
  argument?: ((i: Model | undefined) => void) | boolean){

  return child(
    function use(key){
      let instance: Model | undefined;
  
      const update = (next: Model | {} | undefined) => {
        instance =
          next instanceof Model ? next :
          next && bootstrap(next);
  
        if(instance){
          Parent.set(instance, this.subject);
          manage(instance);
        }
  
        if(typeof argument == "function")
          argument(instance);
        else if(!instance && argument !== false)
          throw Oops.UndefinedNotAllowed(key);
      }
  
      if(input){
        instance =
          Model.isTypeof(input) ? new input() :
          input instanceof Model ? input :
          typeof input === "function" ? input() :
          typeof input === "object" ? bootstrap(input) :
          Oops.BadArgument(typeof input).throw();
  
        if(instance)
          update(instance);
      }
      else
        argument = false;
  
      this.manage(key, instance, update);
  
      return () => instance;
    }
  )
}

export function parent<T extends typeof Model>(
  Expects: T, required?: boolean): InstanceOf<T> {

  return set(
    function parent(){
      const child = this.subject;
      const expected = Expects.name;
      const value = Parent.get(this.subject);
  
      if(!value){
        if(required)
          throw Oops.ParentRequired(expected, child);
      }
      else if(!(value instanceof Expects))
        throw Oops.UnexpectedParent(expected, child, value);
  
      return { value };
    }
  );
}