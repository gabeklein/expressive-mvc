import State from '@expressive/react';

// Theme is global by nature - there is only one document to paint - so it says
// so. The effect in new() writes the active theme to the root element,
// retinting everything.
export class Theme extends State {
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
