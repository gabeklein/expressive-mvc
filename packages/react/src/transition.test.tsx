import { act, render } from '@testing-library/react';
import { Suspense } from 'react';
import { describe, expect, it } from 'vitest';

import { Provider, State, transition } from '.';
import { Runtime } from './adapter';
import { mockPromise } from '../test.setup';

describe('transition', () => {
  class Test extends State {
    value = 'a';
    busy = false;
  }

  function scenario() {
    const test = Test.new();
    const gate = mockPromise<void>();
    let ready = false;

    gate.then(() => {
      ready = true;
    });

    const Page = () => {
      const { value } = Test.get();

      if (value === 'b' && !ready) throw gate;

      return <span>{value}</span>;
    };

    const Status = () => <b>{Test.get().busy ? 'busy' : 'idle'}</b>;

    const view = render(
      <Provider for={test}>
        <Status />
        <Suspense fallback={<i>fallback</i>}>
          <Page />
        </Suspense>
      </Provider>
    );

    return { test, gate, text: () => view.container.textContent };
  }

  it('will resolve once deferred work is presented', async () => {
    const { test, gate, text } = scenario();

    expect(text()).toBe('idlea');

    await act(async () => {
      test.busy = true;
      transition(() => {
        test.value = 'b';
      }).then(() => {
        test.busy = false;
      });
      await Promise.resolve();
    });

    expect(text()).toBe('busya');

    await act(async () => {
      gate.resolve();
      await gate;
    });

    expect(text()).toBe('idleb');
  });

  it('will defer without observing where the host cannot report', async () => {
    const { useTransition } = Runtime;
    delete Runtime.useTransition;

    try {
      const { test, gate, text } = scenario();

      expect(text()).toBe('idlea');

      await act(async () => {
        transition(() => {
          test.value = 'b';
        });
        await Promise.resolve();
      });

      await act(async () => {
        gate.resolve();
        await gate;
      });

      expect(text()).toBe('idleb');
    } finally {
      Runtime.useTransition = useTransition;
    }
  });

  describe('pending', () => {
    class App extends State {
      page = 'a';
      busy = false;

      go(to: string) {
        this.busy = true;
        transition(() => {
          this.page = to;
        }).then(() => {
          this.busy = false;
        });
      }
    }

    function gated() {
      const app = App.new();
      const gate = mockPromise<void>();
      let ready = false;

      gate.then(() => {
        ready = true;
      });

      return {
        app,
        gate,
        suspend: (page: string) => {
          if (page === 'b' && !ready) throw gate;
        }
      };
    }

    it('will hold the previous screen where read above deferred content', async () => {
      const { app, gate, suspend } = gated();

      const Frame = (props: { children?: unknown }) => (
        <div>{App.get().busy ? 'dim:' : 'live:'}{props.children as any}</div>
      );

      const Screen = () => {
        const { page } = App.get();
        suspend(page);
        return <span>{page}</span>;
      };

      const view = render(
        <Provider for={app}>
          <Frame>
            <Suspense fallback={<i>fallback</i>}>
              <Screen />
            </Suspense>
          </Frame>
        </Provider>
      );

      await act(async () => {
        app.go('b');
        await Promise.resolve();
      });

      expect(view.container.querySelector('i')).toBeNull();
      expect(view.container.textContent).toBe('dim:a');

      await act(async () => {
        gate.resolve();
        await gate;
      });

      expect(view.container.textContent).toBe('live:b');
    });

    it('will not hold where one component reads both', async () => {
      const { app, suspend } = gated();

      const Screen = () => {
        const { page, busy } = App.get();
        suspend(page);
        return <span>{busy ? 'dim:' : 'live:'}{page}</span>;
      };

      const view = render(
        <Provider for={app}>
          <Suspense fallback={<i>fallback</i>}>
            <Screen />
          </Suspense>
        </Provider>
      );

      await act(async () => {
        app.go('b');
        await Promise.resolve();
      });

      expect(view.container.querySelector('i')).not.toBeNull();
    });
  });

  it('will resolve without a mounted driver', async () => {
    const test = Test.new();
    let done = false;

    await transition(() => {
      test.value = 'b';
    }).then(() => {
      done = true;
    });

    expect(done).toBe(true);
  });
});
