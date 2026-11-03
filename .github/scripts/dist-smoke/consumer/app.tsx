import { Component, has } from '@expressive/mvc';
import { Css, render } from '@expressive/dom';
import { Link, Route, Router } from '@expressive/router';

class Item extends Component {
  name = '';

  render() {
    return <li>{this.name}</li>;
  }
}

const style = Css.use();

style(Item, { size: 4, _first: { size: [1, 2] } });

class List extends Component {
  items = has(Item);
  draft = '';

  new() {
    this.items.add({ name: 'a' });
    this.get(() => {
      document.body.dataset.mounted = 'list';
      return () => delete document.body.dataset.mounted;
    });
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

const Other = () => import('./other');

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
