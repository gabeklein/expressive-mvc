import { Observable } from "@expressive/mvc";
import { Pragma } from "./adapter";

function use<T extends Observable>(value: T): T;
function use<T extends Observable>(value: Promise<T>): T | undefined;
function use<T extends Observable>(value: T | Promise<T>): T | undefined{
  const render = Pragma.useFactory((refresh) => {
    let output: T | undefined;
    let error: Error | undefined;

    if(value instanceof Promise){
      value.then(x => value = x, e => error = e).finally(refresh);
      output = undefined;
    }

    return () => {
      if(error)
        throw error;
      
      return output;
    };
  });

  return render();
}

export { use }