import { it } from 'vitest';
import { Component, State, pending } from '@expressive/mvc';
import { lazy, render } from './index';
import { mockPromise } from '../test.setup';

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

it('transition gap: remounted deep content suspends', async () => {
  const gate = mockPromise<() => Component.Node>();
  const Lazy = lazy(() => gate);
  class Nav extends State { page = 'a'; }
  function Address() { return <b>{Nav.get().page}</b>; }
  function Inner({ page }: { page: string }) {
    return page == 'b' ? <Lazy /> : <span>{page}</span>;
  }
  function Page() {
    const { page } = Nav.get();
    return <section><em>{page}</em><div><Inner key={page} page={page} /></div></section>;
  }
  class App extends Component {
    nav = new Nav();
    fallback = <i>loading</i>;
    render() { return <div><Address /><Page /></div>; }
  }
  let app!: App;
  const root = document.createElement('main');
  render(<App is={(v) => (app = v)} />, root);
  console.log('initial:', root.textContent);
  pending(() => { app.nav.page = 'b'; });
  await tick();
  console.log('during transition:', root.textContent);
  gate.resolve(() => <span>B</span>);
  await tick();
  console.log('after:', root.textContent);
});
