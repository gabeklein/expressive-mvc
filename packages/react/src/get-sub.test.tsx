/** @jsxImportSource . */
import { expect, it, act, render, screen } from '../vitest';
import State from '.';

it('State.use updates', async () => {
  class Test extends State {
    value = 0;
    render() { return <span>{this.value}</span>; }
  }
  let instance!: Test;
  render(<Test is={(x) => (instance = x)} />);
  expect(screen.getByText('0')).toBeTruthy();
  await act(async () => { instance.value = 1; });
  expect(screen.getByText('1')).toBeTruthy();
});
