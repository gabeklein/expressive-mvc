import { Component, has } from '@expressive/mvc';
import { css, macro, render, style } from '@expressive/dom';
import { Link, Route, Router } from '@expressive/router';

class Item extends Component {
  name = '';

  render() {
    return <li>{this.name}</li>;
  }
}

macro(css);
style(Item, { px: 4, _first: { mx: 2 } });

class List extends Component {
  items = has(Item);
  draft = '';

  new() {
    this.items.add({ name: 'a' });
  }

  add() {
    this.items.add({ name: this.draft });
    this.draft = '';
  }

  render() {
    return (
      <section>
        <input id="draft" value={this.draft} onInput={(event) => (this.draft = event.currentTarget.value)} />
        <button id="add" onClick={this.add}>add</button>
        <ul id="items">{this.items}</ul>
      </section>
    );
  }
}

const Frame = (props: { children?: Component.Node }) => (
  <main>
    <Link to="/other">other</Link>
    <Component fallback={<p>loading</p>}>{props.children}</Component>
  </main>
);

const Other = () => <p id="other">other</p>;

export function mount(root: Element) {
  return render(
    <Router>
      <Route as={Frame}>
        <Route as={List} />
        <Route to="other" as={Other} />
      </Route>
    </Router>,
    root
  );
}
