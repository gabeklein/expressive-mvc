import { set } from "./instructions";

export const suspend = <T = never>(
  source: (tag?: T) => Promise<void>): (tag?: T) => void => set(

  function suspense(){
    let suspend = true;
    let error: any;

    return {
      value: (tag: T) => {
        if(error)
          throw error;

        if(suspend)
          throw source(tag)
            .then(() => suspend = false)
            .catch(err => error = err)
      }
    }
  }
);