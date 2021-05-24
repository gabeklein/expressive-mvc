import { renderHook, RenderHookResult } from '@testing-library/react-hooks';

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

export { create as render } from "react-test-renderer";
export { trySubscribe as test };
export { subscribeTo }

interface RenderControllerResult<T> 
  extends RenderHookResult<unknown, T> {
  /** Reference to controller instance. */
  state: T;
  /** Check if rerender was requested. Will reject if not. */
  assertDidUpdate(): Promise<void>
  /** Assert a rerender was not requested. Will reject if one was. */
  assertDidNotUpdate(): Promise<void>
}

const STACK_FRAME = / *at ([^\/].+?)?(?: \()?(\/[\/a-zA-Z-_.]+):(\d+):(\d+)/;

/**
 * Error with test-friendlier stack trace. 
 * 
 * Create prior to running an async operation. 
 * Throwing a pre-initialized error from closure highlights the failed promise.
 */
class TraceableError extends Error {
  constructor(message: string){
    super(message);

    let [ error, ...stack ] = this.stack!.split(/\n/);

    let trace = stack.map(match => {
      const [ frame, callee, file, line, column ] = 
        STACK_FRAME.exec(match) || [];

      return { frame, callee, file, line, column }
    })

    trace = trace.filter(x => x.file);
    
    const adaptor = trace[0].file;
    const frames = trace
      .filter(x => x.file !== adaptor)
      .map(l => l.frame);

    this.stack = [ error ].concat(frames).join("\n");
  }
}

/**
 * Test a ModelController with this. 
 * Equivalent to `renderHook`, however for controllers.
 */
function trySubscribe<T>(init: () => T): RenderControllerResult<T>
function trySubscribe(init: () => Public.Controller){
  const render = renderHook(init);

  async function assertDidUpdate(){
    const error = new TraceableError("Assertion failed: hook did not update");
    let didUpdate = false;

    setTimeout(() => { 
      if(!didUpdate) 
        throw error
    }, 500)

    await render.waitForNextUpdate();
    
    didUpdate = true
  }

  async function assertDidNotUpdate(){
    const error = new TraceableError("Assertion failed: hook did update");
    let elapsed = false;

    setTimeout(() => {
      elapsed = true;
      render.rerender();
    }, 500)
    
    await render.waitForNextUpdate();

    if(!elapsed) 
      throw error;
  }

  return Object.assign(render, {
    state: render.result.current,
    assertDidUpdate,
    assertDidNotUpdate
  })
}

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