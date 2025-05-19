import { renderHook, act as testingLibraryAct } from '@testing-library/react';

import { Model, Provider } from '.';

interface MockHook<T> extends jest.Mock<T, []> {
  /** Current output of this hook. */
  readonly output: T;

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
export function mockHook<T>(arg1: (() => T) | Model | Model.Init, arg2?: () => T) {
  let impl = typeof arg1 !== 'function' || Model.is(arg1) ? arg2! : arg1;
  let wrapper: React.FC<React.PropsWithChildren> | undefined;

  if (Model.is(arg1) || arg1 instanceof Model)
    wrapper = ({ children }) => <Provider for={arg1}>{children}</Provider>;

  const mock = jest.fn(() => impl()) as MockHook<T>;
  const result = renderHook(mock, { wrapper });

  mock.act = async (fn: () => void | Promise<void>) => {
    await testingLibraryAct(async () => fn());
  };

  mock.update = async (next?: () => T) => {
    if (next) impl = next;
    result.rerender();
  };

  mock.unmount = async () => {
    result.unmount();
  };

  Object.defineProperty(mock, 'output', {
    get: () => result.result.current
  });

  return mock;
}

