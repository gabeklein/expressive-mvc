import { Global as Active, MVC } from './mvc';

export class Global extends MVC {
  static global = true;
  static keepAlive = true;

  /** Destroy current instance of Global, if it exists. */
  static reset(){
    const current = Active.get(this) as Global;

    if(current)
      current.end(true);
  }
}