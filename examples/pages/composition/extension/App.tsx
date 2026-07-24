import './App.css';

import { Component } from '@expressive/react';
import type { ReactNode } from 'react';

// A base that owns shared chrome. When a subclass overrides render(),
// it COMPOSES with the base instead of replacing it: the base render
// runs outermost, and the subclass's output arrives as `props.children`.
// No super.render() call - just read children where content should slot.
class Panel extends Component {
  title = 'Panel';

  render(props = {} as { children?: ReactNode }) {
    return (
      <section className="panel">
        <header>{this.title}</header>
        <div className="body">{props.children}</div>
      </section>
    );
  }
}

// Each subclass authors only its content; the Panel chrome wraps it.
class Welcome extends Panel {
  title = 'Welcome';

  render() {
    return <p>This paragraph slots into the Panel chrome - defined once, above.</p>;
  }
}

class Goodbye extends Panel {
  title = 'Goodbye';

  render() {
    return <p>So does this one. Same base, different content.</p>;
  }
}

export default () => (
  <div className="container">
    <h1>Render Composition</h1>
    <Welcome />
    <Goodbye />
  </div>
);
