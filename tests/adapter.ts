// source code
import * as Source from "../src";
// public type definitions
import * as Public from "../";

export { default as Issue } from "../src/issues";

export const Controller = Source.Controller as unknown as typeof Public.Controller;
export const Singleton = Source.Singleton as unknown as typeof Public.Singleton;
export const Provider = Source.Provider as unknown as typeof Public.Provider;
export const Consumer = Source.Consumer as unknown as typeof Public.Consumer;

export const tap = Source.tap as typeof Public.tap;
export const set = Source.watch as typeof Public.watch;
export const ref = Source.ref as typeof Public.ref;
export const use = Source.use as typeof Public.use;
export const hoc = Source.hoc as typeof Public.hoc;
export const wrap = Source.wrap as typeof Public.wrap;
export const act = Source.act as typeof Public.act;
export const event = Source.event as typeof Public.event;
export const parent = Source.parent as typeof Public.parent;

export { renderHook } from '@testing-library/react-hooks';
export { create as render } from "react-test-renderer";
export { subscribeTo }

function subscribeTo<T extends Public.Controller>(
  target: T,
  accessor: (self: T) => void){

  const didTrigger = jest.fn();

  target.effect(self => {
    accessor(self);
    didTrigger();
  });

  // ignore initial invocation.
  didTrigger.mockReset();
  
  return async (isExpected = true) => {
    await new Promise(res => setImmediate(res));

    if(isExpected){
      expect(didTrigger).toHaveBeenCalled();
      didTrigger.mockReset();
    }
    else
      expect(didTrigger).not.toHaveBeenCalled();
  }
}