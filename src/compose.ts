import { child } from './attach';
import { apply } from './controller';
import { issues } from './issues';
import { CONTROL, Model } from './model';
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
  argument?: ((i: Model | undefined) => boolean) | boolean){

  return child(
    function use(key){
      const { subject } = this;

      // `true` => readonly
      // `false` => writable, may be undefined
      // `undefined` => writable (default)
      let mode = argument;
      let current: Model | undefined;
  
      const onUpdate = (
        next: Model | {} | undefined,
        initial?: boolean) => {

        if(mode === true && !initial)
          throw Oops.IsReadOnly(subject, key);

        if(next){
          current = next instanceof Model
            ? next : bootstrap(next);

          Parent.set(current, subject);
          current[CONTROL];
        }
        else if(mode === undefined)
          throw Oops.UndefinedNotAllowed(key);
        else
          current = undefined;
  
        if(typeof argument == "function")
          return argument(current);
      }
  
      if(input){
        current =
          Model.isTypeof(input) ? new input() :
          input instanceof Model ? input :
          typeof input === "function" ? input() :
          typeof input === "object" ? bootstrap(input) :
          Oops.BadArgument(typeof input).throw();
  
        if(current)
          mode = onUpdate(current, true) || mode;
        else if(mode == true)
          throw Oops.MustBeDefined(subject, key);
      }
      else
        mode = false;
  
      this.manage(key, current, onUpdate);
  
      return () => current;
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