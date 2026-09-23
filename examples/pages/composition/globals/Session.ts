import State from '@expressive/react';

export class Session extends State {
  // One session for the whole app - the declaration is what makes "the whole
  // app" true of it, rather than a convention the imports happen to follow.
  static global = true;

  user: string | null = null;

  login() {
    this.user = 'Ada';
  }

  logout() {
    this.user = null;
  }
}
