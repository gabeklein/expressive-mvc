import { Suspense } from 'react';
import { act, create } from 'react-test-renderer';

import { Model, Provider } from '.';

interface MockHook<T> extends jest.Mock<T, []> {
  /** Current output of this hook. */
  output: T;

  /** Is currently suspended. */
  suspense: boolean;

  /** Execute an action and wait for new render. */ 
  act(fn: () => Promise<void> | void): Promise<void>;

  /** Force and wait for a new render. */
  update(): Promise<void>;

  /** Update the hook's implementation and wait for new render. */
  update(next?: () => T): Promise<void>;

  /** Unmount the hook. */
  unmount(): Promise<void>;
}

export function mockHook<T>(implementation: () => T): MockHook<T>;
export function mockHook<T>(provide: Model | Model.Init, implementation: () => T): MockHook<T>;
export function mockHook<T>(arg1: (() => T) | Model | Model.Init, arg2?: () => T){
  let implementation = typeof arg1 === 'function' && !Model.is(arg1) ? arg1 : arg2!;

  const mock = jest.fn(() => implementation()) as MockHook<T>;
  let waiting: () => void;

  const Component = () => {
    if(waiting)
      waiting();

    const value = mock();

    mock.output = value;
    mock.suspense = false;

    return null;
  }

  const Pending = () => {
    /* istanbul ignore next */
    if(waiting)
      waiting();

    mock.suspense = true;
    return null;
  }

  let element = (
    <Suspense fallback={<Pending />}>
      <Component />
    </Suspense>
  );

  if(Model.is(arg1) || arg1 instanceof Model)
    element = (
      <Provider for={arg1}>
        {element}
      </Provider>
    );

  const render = create(element);

  mock.unmount = () => {
    render.unmount();
    return new Promise(res => setTimeout(res, 10));
  }

  mock.act = (fn: () => void | Promise<void>) => {
    return act(async () => {
      const pending = new Promise<void>(res => waiting = res);
      await new Promise(res => setTimeout(res, 10)).then(fn);
      await pending;
    });
  }

  mock.update = (next?: () => T) => {
    const pending = new Promise<void>(res => waiting = res);

    if(next)
      implementation = next;

    render.update(
      <Suspense fallback={<Pending />}>
        <Component />
      </Suspense>
    );

    return pending;
  }

  return mock;
}

