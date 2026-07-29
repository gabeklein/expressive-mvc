import State from '@expressive/react';

// App-wide session. One instance for the whole app - login state lives in
// exactly one place, and every component reads the same source of truth.
// The `global` declaration is what makes "the whole app" true of it.
export class Session extends State {
  static global = true;

  user: string | null = null;

  login() {
    this.user = 'Ada';
  }

  logout() {
    this.user = null;
  }
}
