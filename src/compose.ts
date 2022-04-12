import { child } from './attach';
import { apply } from './instruction';
import { issues } from './issues';
import { getController, Model } from './model';
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
    `Instruction \`use\` cannot accept argument type of ${type}.`,

  IsReadOnly: (owner, key) =>
    `${owner}.${key} is set to read-only, but tried to reassign assign.`,

  MustBeDefined: (owner, key) =>
    `${owner}.${key} must have initial value, as a read-only property.`
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
  argument?: (i: Model | undefined) => boolean){

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
          getController(current);
        }
        else
          current = undefined;
  
        if(typeof argument == "function")
          return argument(current);
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

export function parent<T extends typeof Model>(
  Expects: T, required?: boolean): InstanceOf<T> {

  return apply(
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