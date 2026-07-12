import State from '@expressive/react';

// Display-agnostic logic with no render() of its own - a plain State that any
// component can subscribe to. Mutable inputs are fields, derived values are
// getters, and setup/teardown lives in new().
export class Viewport extends State {
  width = window.innerWidth;

  get compact() {
    return this.width < 600;
  }

  // Runs once when ready; the returned function runs on teardown.
  protected new() {
    const update = () => (this.width = window.innerWidth);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }
}
