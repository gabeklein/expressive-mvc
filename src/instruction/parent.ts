import { issues } from '../issues';
import { Model } from '../model';
import { InstanceOf } from '../types';
import { apply } from './apply';

export const Parent = new WeakMap<{}, {}>();

export const Oops = issues({
  ParentRequired: (expects, child) => 
    `New ${child} created standalone but requires parent of type ${expects}. Did you remember to create via use(${child})?`,

  UnexpectedParent: (expects, child, got) =>
    `New ${child} created as child of ${got}, but must be instanceof ${expects}.`,
})

/**
 * Fetches and assigns the controller which spawned this host.
 * When parent assigns an instance via `use()` directive, it
 * will be made available to child upon this request.
 *
 * @param Expects - Type of controller compatible with this class. 
 * @param required - Throw if controller is created independantly.
 */
 function parent <T extends typeof Model> (Expects: T, required: true): InstanceOf<T>;
 function parent <T extends typeof Model> (Expects: T, required?: false): InstanceOf<T> | undefined;
  
 function parent<T extends typeof Model>(
   Expects: T, required?: boolean){
 
   return apply(
     function parent(){
       const child = this.subject;
       const value = Parent.get(child) as InstanceOf<T>;
       const expected = Expects.name;
   
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
 
 export { parent }