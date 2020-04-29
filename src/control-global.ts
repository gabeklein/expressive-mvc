import { Controller } from './controller';

export class Singleton extends Controller {
  static global = true;
}