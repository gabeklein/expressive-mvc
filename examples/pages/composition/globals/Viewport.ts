import State from '@expressive/react';

// Display-agnostic logic with no render() of its own: mutable inputs are
// fields, derived values are getters, setup and teardown live in new().
export class Viewport extends State {
  // Reachable app-wide. Without this line the instance is private to whoever
  // created it - everything here still works, but Viewport.get() finds nothing.
  static global = true;

  width = window.innerWidth;

  get compact() {
    return this.width < 600;
  }

  protected new() {
    const update = () => (this.width = window.innerWidth);

    window.addEventListener('resize', update);

    return () => window.removeEventListener('resize', update);
  }
}
