import State from '@expressive/react';

// App-wide session. One instance for the whole app - login state lives in
// exactly one place, and every component reads the same source of truth.
export class Session extends State {
  user: string | null = null;

  login() {
    this.user = 'Ada';
  }

  logout() {
    this.user = null;
  }
}
