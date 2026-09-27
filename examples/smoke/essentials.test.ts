import { describe, expect, it } from 'vitest';
import { act, mount } from './harness';

describe('essentials/counter', () => {
  it('will increment, decrement and reset', async () => {
    const page = await mount('essentials/counter');
    const pre = page.container.querySelector('pre')!;
    expect(pre.textContent).toBe('1');
    await act.click(page.getByText('+'));
    await act.click(page.getByText('+'));
    expect(pre.textContent).toBe('3');
    await act.click(page.getByText('−'));
    expect(pre.textContent).toBe('2');
    await act.click(pre);
    expect(pre.textContent).toBe('1');
  });
});
