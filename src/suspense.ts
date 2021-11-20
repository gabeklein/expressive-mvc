import { set } from "./instructions";

export const suspend = <T = void>(
  source: () => Promise<T>): T => set(

  function suspense(){
    let waiting = true;
    let output: any;
    let error: any;

    return () => {
      if(waiting)
        throw source
          .call(this.subject)
          .catch(err => error = err)
          .then((value) => output = value)
          .finally(() => waiting = false)

      if(error)
        throw error;

      return output;
    }
  }
);