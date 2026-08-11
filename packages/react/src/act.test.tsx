import { act, render } from '@testing-library/react';
import { Activity, Suspense, useState } from 'react';
import { describe, expect, it } from 'vitest';

import { Component, Provider, State } from '.';
import { mockPromise } from '../test.setup';

describe('State.act', () => {
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

      act(work: () => void) {
        this.busy = true;
        return super.act(work).then(() => {
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
      shell.act(() => {
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

  it('will hold for a plain State, with no Component involved', async () => {
    const { gate, data, Content } = scenario();
    let busy = true;

    const view = render(
      <Provider for={data}>
        <Content />
      </Provider>
    );

    await act(async () => {});

    await act(async () => {
      data.act(() => {
        data.value = 'b';
      }).then(() => (busy = false));
      await Promise.resolve();
    });

    expect(view.container.querySelector('i')).toBeNull();
    expect(view.container.textContent).toBe('a');
    expect(busy).toBe(true);

    await act(async () => {
      gate.resolve();
      await gate;
    });

    expect(view.container.textContent).toBe('b');
    expect(busy).toBe(false);
  });

  it('will release a claim when its subscriber is hidden mid-act', async () => {
    const { gate, data, Content } = scenario();
    let settled = false;
    let hide!: () => void;

    const App = () => {
      const [mode, set] = useState<'visible' | 'hidden'>('visible');
      hide = () => set('hidden');
      return (
        <Activity mode={mode}>
          <Content />
        </Activity>
      );
    };

    render(
      <Provider for={data}>
        <App />
      </Provider>
    );

    await act(async () => {});

    await act(async () => {
      data.act(() => {
        data.value = 'b';
      }).then(() => (settled = true));
      await Promise.resolve();
    });

    expect(settled).toBe(false);

    await act(async () => hide());

    expect(settled).toBe(true);

    gate.resolve();
  });

  it('will not claim for a subscriber which is already hidden', async () => {
    const { data, Content } = scenario();
    let settled = false;

    render(
      <Provider for={data}>
        <Activity mode="hidden">
          <Content />
        </Activity>
      </Provider>
    );

    await act(async () => {});

    await act(async () => {
      data.act(() => {
        data.value = 'b';
      }).then(() => (settled = true));
      await Promise.resolve();
    });

    expect(settled).toBe(true);
  });

  it('will settle on dispatch before mount', async () => {
    const data = Data.new();
    const shell = (class extends Component {}).new();
    let settled = false;

    await shell.act(() => {
      data.value = 'b';
    }).then(() => {
      settled = true;
    });

    expect(settled).toBe(true);
  });

  it('will track pending without an own transition', async () => {
    const { gate, data, Content } = scenario();
    let shell!: Shell;

    const Status = () => <b>{Shell.get().pending ? 'busy' : 'idle'}</b>;

    class Shell extends Component {
      pending = false;

      go(to: string) {
        this.pending = true;
        this.act(() => {
          data.value = to;
        }).then(() => {
          this.pending = false;
        });
      }

      render() {
        return (
          <>
            <Status />
            <Content />
          </>
        );
      }
    }

    const view = render(
      <Provider for={data}>
        <Shell is={(i) => (shell = i)} />
      </Provider>
    );

    await act(async () => {});

    expect(view.container.textContent).toBe('idlea');

    await act(async () => {
      shell.go('b');
      await Promise.resolve();
    });

    expect(view.container.querySelector('i')).toBeNull();
    expect(view.container.textContent).toBe('busya');

    await act(async () => {
      gate.resolve();
      await gate;
    });

    expect(view.container.textContent).toBe('idleb');
  });

});

describe('act teardown', () => {
  it('will settle work left pending by an unmount', async () => {
    class Data extends State {
      value = 'a';
    }

    const data = Data.new();
    const gate = mockPromise<void>();
    let shell!: Shell;
    let settled = false;

    const Screen = () => {
      const { value } = Data.get();
      if (value === 'b') throw gate;
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
      shell.act(() => {
        data.value = 'b';
      }).then(() => {
        settled = true;
      });
      await Promise.resolve();
    });

    expect(settled).toBe(false);

    await act(async () => {
      view.unmount();
      await Promise.resolve();
    });

    expect(settled).toBe(true);
  });
});
