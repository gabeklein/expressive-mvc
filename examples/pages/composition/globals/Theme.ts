import State from '@expressive/react';

export class Theme extends State {
  // Global by nature: there is only one document to paint.
  static global = true;

  dark = false;

  toggle() {
    this.dark = !this.dark;
  }

  protected new() {
    return this.get(({ dark }) => {
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    });
  }
}
