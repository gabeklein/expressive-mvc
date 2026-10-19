import { describe, expect, it } from 'vitest';

import { Component } from '@expressive/mvc';
import { flushMicrotasks, place } from '../../test.setup';

describe('dom host', () => {
  it('will not restore a controlled value after its element unmounts', async () => {
    class Form extends Component {
      open = true;

      render() {
        const { open } = this;

        return open && <input value="fixed" onInput={() => (this.open = false)} />;
      }
    }

    const root = place(<Form />, document.body.appendChild(document.createElement('main')));
    const input = root.querySelector('input')!;

    input.value = 'typed';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await flushMicrotasks();

    expect(root.querySelector('input')).toBeNull();
    expect(input.value).toBe('typed');
  });
});
