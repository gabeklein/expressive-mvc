import { act, render } from '@testing-library/react';
import { Suspense } from 'react';
import { describe, expect, it } from 'vitest';

import { Component, Provider, State } from '.';
import { Runtime } from './adapter';
import { mockPromise } from '../test.setup';

describe('Component.transition', () => {
  function gated() {
    const gate = mockPromise<void>();
    let ready = false;

    gate.then(() => {
      ready = true;
    });

    return {
      gate,
      suspend: (value: string) => {
        if (value === 'b' && !ready) throw gate;
      }
    };
  }

  class Data extends State {
    value = 'a';
  }

  it('will hold current content until the replacement is presented', async () => {
    const { gate, suspend } = gated();
    const data = Data.new();
    let shell!: Shell;
    let settled = false;

    const Screen = () => {
      const { value } = Data.get();
      suspend(value);
      return <span>{value}</span>;
    };

    class Shell extends Component {
      render() {
        return (
          <Suspense fallback={<i>fallback</i>}>
            <Screen />
          </Suspense>
        );
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

    expect(view.container.querySelector('i')).toBeNull();
    expect(view.container.textContent).toBe('a');
    expect(settled).toBe(false);

    await act(async () => {
      gate.resolve();
      await gate;
    });

    expect(view.container.textContent).toBe('b');
    expect(settled).toBe(true);
  });

  it('will settle where the host cannot report', async () => {
    const { useTransition } = Runtime;
    delete Runtime.useTransition;

    try {
      const { gate, suspend } = gated();
      const data = Data.new();
      let shell!: Shell;

      const Screen = () => {
        const { value } = Data.get();
        suspend(value);
        return <span>{value}</span>;
      };

      class Shell extends Component {
        render() {
          return (
            <Suspense fallback={<i>fallback</i>}>
              <Screen />
            </Suspense>
          );
        }
      }

      const view = render(
        <Provider for={data}>
          <Shell is={(i) => (shell = i)} />
        </Provider>
      );

      await act(async () => {});

      let settled = false;

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
});
