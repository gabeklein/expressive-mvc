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
