import { issues } from '../helper/issues';
import { Model } from '../model';
import { add } from './add';
import { Parent } from './use';

export const Oops = issues({
  Required: (expects, child) => 
    `New ${child} created standalone but requires parent of type ${expects}. Did you remember to create via use(${child})?`,

  Unexpected: (expects, child, got) =>
    `New ${child} created as child of ${got}, but must be instanceof ${expects}.`,
})

/**
 * Fetches and assigns the controller which spawned this host.
 * When parent assigns an instance via `use()` directive, it
 * will be made available to child upon this request.
 *
 * @param Type - Type of controller compatible with this class. 
 * @param required - Throw if controller is created independantly.
 */
function has <T extends Model> (Type: Model.Type<T>, required: false): T | undefined;
function has <T extends Model> (Type: Model.Type<T>, required?: true): T;

function has<T extends Model>(
  Type: Model.Type<T>, required?: boolean){

   return add(
     function parent(){
       const child = this.subject;
       const value = Parent.get(child) as T;
       const expected = Type.name;

       if(!value){
         if(required !== false)
           throw Oops.Required(expected, child);
       }
       else if(!(value instanceof Type))
         throw Oops.Unexpected(expected, child, value);

       return { value };
     }
   );
 }

 export { has }