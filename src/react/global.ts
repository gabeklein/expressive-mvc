import { MVC } from './mvc';

export class Global extends MVC {
  static global = true;
  static keepAlive = true;
}