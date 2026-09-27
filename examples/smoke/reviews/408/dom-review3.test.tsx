import { expect, it } from 'vitest';
import { Component, State } from '@expressive/mvc';
import { render } from './index';

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

it('C3b', async () => {
  const log: string[] = [];
  class Fix extends State { broken = true; }
  const fix = Fix.new();
  let renders = 0;
  class Inner extends Component {
    fallback = <i>inner</i>;
    async catch(error: Error) { log.push('catch'); if (log.length > 20) return; throw error; }
    render() {
      if (++renders > 20) return <b>bail</b>;
      if (fix.broken) throw new Error('broken');
      return <p>content</p>;
    }
  }
  const root = document.createElement('main');
  let err: unknown;
  try { render(<Inner />, root); } catch (e) { err = e; }
  await tick();
  log.push('renders ' + renders + ' text ' + root.textContent + ' err ' + err);
  fix.broken = false;
  await tick();
  log.push('renders ' + renders + ' text ' + root.textContent);
  expect(log).toEqual([]);
});
