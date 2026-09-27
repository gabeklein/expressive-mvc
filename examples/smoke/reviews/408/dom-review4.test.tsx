import { expect, it } from 'vitest';
import { Component } from '@expressive/mvc';
import { render } from './index';
import { mockPromise } from '../test.setup';

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

it('C6 will reveal on a state change after a retry failed again', async () => {
  let fails = 2;
  class Inner extends Component {
    n = 0;
    render() {
      const { n } = this;
      if (fails-- > 0) throw new Error('broken');
      return <p>content {n}</p>;
    }
  }
  class Outer extends Component {
    fallback = <i>outer</i>;
    async catch() {}
    render() { return <Inner is={(v) => (inner = v)} />; }
  }
  let inner!: Inner;
  const root = document.createElement('main');
  render(<Outer />, root);
  await tick();
  inner.n++;
  await tick();
  expect(root.textContent).toBe('content 1');
});

it('C7 will keep holding while a second catch for the scope is pending', async () => {
  const calls = [mockPromise<void>(), mockPromise<void>()];
  let count = 0;
  class Inner extends Component {
    n = 0;
    render() {
      const { n } = this;
      if (n < 2) throw new Error('broken ' + n);
      return <p>content</p>;
    }
  }
  class Outer extends Component {
    fallback = <i>outer</i>;
    catch() { return calls[count++]; }
    render() { return <Inner is={(v) => (inner = v)} />; }
  }
  let inner!: Inner;
  const root = document.createElement('main');
  render(<Outer />, root);
  await tick();
  inner.n = 1;
  await tick();
  expect(count).toBe(2);
  inner.n = 2;
  await tick();
  expect(root.textContent).toBe('outer');
  calls[0].resolve();
  await tick();
  expect(root.textContent).toBe('outer');
});
