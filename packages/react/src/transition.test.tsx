import { act, render } from '@testing-library/react';
import { Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Component, Provider, State } from '.';
import { Runtime } from './adapter';
import { mockPromise } from '../test.setup';

describe('Component.transition', () => {
  class Data extends State {
    value = 'a';
  }

  /** A screen which suspends on `b` until its gate resolves. */
  function scenario() {
    const gate = mockPromise<void>();
    const data = Data.new();
    let ready = false;

    gate.then(() => {
      ready = true;
    });

    const Screen = () => {
      const { value } = Data.get();

      if (value === 'b' && !ready) throw gate;

      return <span>{value}</span>;
    };

    const Content = () => (
      <Suspense fallback={<i>fallback</i>}>
        <Screen />
      </Suspense>
    );

    return { gate, data, Content };
  }

  it('will hold current content until the replacement is presented', async () => {
    const { gate, data, Content } = scenario();
    let shell!: Shell;

    class Shell extends Component {
      busy = false;

      transition(work: () => void) {
        this.busy = true;
        return super.transition(work).then(() => {
          this.busy = false;
        });
      }

      render() {
        return <Content />;
      }
    }

    const view = render(
      <Provider for={data}>
        <Shell is={(i) => (shell = i)} />
      </Provider>
    );

    await act(async () => {});

    await act(async () => {
      shell.transition(() => {
        data.value = 'b';
      });
      await Promise.resolve();
    });

    expect(view.container.querySelector('i')).toBeNull();
    expect(view.container.textContent).toBe('a');
    expect(shell.busy).toBe(true);

    await act(async () => {
      gate.resolve();
      await gate;
    });

    expect(view.container.textContent).toBe('b');
    expect(shell.busy).toBe(false);
  });

  it('will settle on dispatch where the host cannot report', async () => {
    const { useTransition } = Runtime;
    delete Runtime.useTransition;

    try {
      const { gate, data, Content } = scenario();
      let shell!: Shell;
      let settled = false;

      class Shell extends Component {
        transition(work: () => void) {
          return super.transition(work);
        }

        render() {
          return <Content />;
        }
      }

      const view = render(
        <Provider for={data}>
          <Shell is={(i) => (shell = i)} />
        </Provider>
      );

      await act(async () => {});

      await act(async () => {
        shell.transition(() => {
          data.value = 'b';
        }).then(() => {
          settled = true;
        });
        await Promise.resolve();
      });

      expect(settled).toBe(true);

      await act(async () => {
        gate.resolve();
        await gate;
      });

      expect(view.container.textContent).toBe('b');
    } finally {
      Runtime.useTransition = useTransition;
    }
  });

  it('will settle on dispatch before mount', async () => {
    const data = Data.new();
    const shell = (class extends Component {}).new();
    let settled = false;

    await shell.transition(() => {
      data.value = 'b';
    }).then(() => {
      settled = true;
    });

    expect(settled).toBe(true);
  });

  it('will not mount a driver where transition is inherited', async () => {
    const { data, Content } = scenario();
    const hook = vi.spyOn(Runtime, 'useTransition');
    let shell!: Shell;
    let settled = false;

    class Shell extends Component {
      render() {
        return <Content />;
      }
    }

    render(
      <Provider for={data}>
        <Shell is={(i) => (shell = i)} />
      </Provider>
    );

    await act(async () => {});

    expect(hook).not.toHaveBeenCalled();

    await act(async () => {
      shell.transition(() => {
        data.value = 'b';
      }).then(() => {
        settled = true;
      });
      await Promise.resolve();
    });

    expect(settled).toBe(true);
    expect(hook).not.toHaveBeenCalled();

    hook.mockRestore();
  });
});
