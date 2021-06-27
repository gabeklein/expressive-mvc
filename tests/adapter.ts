// source code
import * as Source from "../src";
// public type definitions
import * as Public from "../";

export { renderHook } from '@testing-library/react-hooks';
export { create as render } from "react-test-renderer";

export { default as Issue } from "../src/issues";

export const Model = Source.Model as unknown as typeof Public.Model;
export const Singleton = Source.Singleton as unknown as typeof Public.Singleton;
export const Provider = Source.Provider as unknown as typeof Public.Provider;
export const Consumer = Source.Consumer as unknown as typeof Public.Consumer;

export const tap = Source.tap as typeof Public.tap;
export const on = Source.on as typeof Public.on;
export const ref = Source.ref as typeof Public.ref;
export const binds = Source.binds as typeof Public.binds;
export const use = Source.use as typeof Public.use;
export const act = Source.act as typeof Public.act;
export const lazy = Source.lazy as typeof Public.lazy;
export const from = Source.from as typeof Public.from;
export const parent = Source.parent as typeof Public.parent;

export function subscribeTo<T extends Public.Model>(
  target: T,
  accessor: (self: T) => void){

  const didTrigger = jest.fn();

  target.effect(self => {
    accessor(self);
    didTrigger();
  });

  // ignore initial scan-phase
  didTrigger.mockReset();
  
  return async (isExpected = true) => {
    await new Promise(res => setTimeout(res, 0));

    if(isExpected){
      expect(didTrigger).toHaveBeenCalled();
      didTrigger.mockReset();
    }
    else
      expect(didTrigger).not.toHaveBeenCalled();
  }
}