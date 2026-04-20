import State from '@expressive/react';

export const DARK = typeof matchMedia === 'undefined' ? null : matchMedia('(prefers-color-scheme: dark)');

export class Theme extends State {
  dark = DARK?.matches ?? false;

  protected new() {
    if (!DARK) return;
    const onChange = () => (this.dark = DARK.matches);
    DARK.addEventListener('change', onChange);
    return () => DARK.removeEventListener('change', onChange);
  }
}