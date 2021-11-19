import { set } from "./instructions";

export const suspend = <T = void>(
  source: () => Promise<T>): T => set(

  function suspense(){
    let returned: any;
    let waiting = true;
    let error: any;

    return () => {
      if(error)
        throw error;

      if(waiting)
        throw source()
          .catch(err => error = err)
          .then((value) => {
            returned = value;
            waiting = false;
          })

      return returned;
    }
  }
);