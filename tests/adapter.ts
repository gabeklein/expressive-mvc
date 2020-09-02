import { renderHook, RenderHookResult } from '@testing-library/react-hooks';

// source code
import * as Source from "../src";
// public type definitions
import * as Public from "../";

export const get = Source.get as typeof Public.get;
export const Controller = Source.Controller as unknown as typeof Public.Controller;
export const Provider = Source.Provider as unknown as typeof Public.Provider;
export default Controller;

export { trySubscribe as test };

type Class = new(...args: any[]) => any;

const frame = / *at ([^\/].+?)?(?: \()?(\/[\/a-zA-Z-_.]+):(\d+):(\d+)/;

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

    let trace = stack.map(line => {
      const match = frame.exec(line) || [] as string[];
      return {
        frame: match[0],
        callee: match[1],
        file: match[2],
        line: match[3],
        column: match[4]
      }
    })

    trace = trace.filter(x => x.file);
    
    const adaptor = trace[0].file;

    trace = trace.filter(x => x.file !== adaptor);

    this.stack = [
      error, ...trace.map(l => l.frame)
    ].join("\n");
  }
}

/**
 * Test a ModelController with this. 
 * Equivalent to `renderHook`, however for controllers.
 */
function trySubscribe<T>(
  init: () => T,
  watchProperties?: string[]
): RenderControllerResult<T>

function trySubscribe<T extends Class>(
  type: T,
  watchProperties?: string[]
): RenderControllerResult<InstanceType<T>>

function trySubscribe(
  init: (() => Public.Controller) | typeof Public.Controller,
  watch?: string[]){

  if("prototype" in init){
    const Model = init as typeof Public.Controller;
    init = () => Model.use();
  }

  if(watch){
    const createController = init;
    init = () => {
      const x = createController();
      mockPropertyAccess(x, watch);
      return x;
    }
  }

  return plusUpdateAssertions(
    renderHook(init)
  );
}

function mockPropertyAccess(
  on: any, properties: string[]){

  for(const property of properties){
    let x: any = on;
    for(const key of property.split("."))
      x = x[key];
  }
}

interface RenderControllerResult<T> 
  extends RenderHookResult<unknown, T> {

  /** Reference to controller instance. */
  state: T;

  /** Check if rerender was requested. Will reject if not. */
  assertDidUpdate(): Promise<void>

  /** Assert a rerender was not requested. Will reject if one was. */
  assertDidNotUpdate(): Promise<void>
}

function plusUpdateAssertions(
  result: RenderHookResult<any, any>){

  const patched = result as RenderControllerResult<any>;
  let { current } = patched.result;
  
  patched.state = current;

  patched.assertDidUpdate = async () => {
    const error = new TraceableError("Assertion failed: hook did not update");
    let didUpdate = false;

    setTimeout(() => { 
      if(!didUpdate) 
        throw error
    }, 500)

    await patched.waitForNextUpdate();
    
    didUpdate = true
  }

  patched.assertDidNotUpdate = async () => {
    const error = new TraceableError("Assertion failed: hook did update");
    let elapsed = false;

    setTimeout(() => {
      elapsed = true;
      patched.rerender();
    }, 500)
    
    await patched.waitForNextUpdate();

    if(!elapsed) 
      throw error;
  }

  return patched;
}