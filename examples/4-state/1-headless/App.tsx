import './App.css';

import State from '@expressive/react';

// Not everything renders itself. When logic is display-agnostic, model it
// as a plain State - no render() - and let any function component subscribe
// with `.use()`. This is the headless half of the library.
//
// Refactoring hooks? Mutable inputs become fields, derived values become
// getters (not effects that sync state), and setup/teardown lives in new().
class Viewport extends State {
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

// A plain function component subscribes; it re-renders when read fields change.
export default function App() {
  const { width, compact } = Viewport.use();

  return (
    <div className="container">
      <h1>Headless State</h1>
      <p className="size">{width}px</p>
      <p>{compact ? 'Compact layout' : 'Wide layout'}</p>
      <small>Resize the panel - width and the derived `compact` track it.</small>
    </div>
  );
}
