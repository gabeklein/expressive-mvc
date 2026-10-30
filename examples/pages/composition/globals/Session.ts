import { Model } from '@expressive/mvc';

export class Session extends Model {
  user: string | null = null;

  login() {
    this.user = 'Ada';
  }

  logout() {
    this.user = null;
  }
}
