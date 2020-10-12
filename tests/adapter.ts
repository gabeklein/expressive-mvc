import { renderHook, RenderHookResult } from '@testing-library/react-hooks';

// source code
import * as Source from "../src";
// public type definitions
import * as Public from "../";

export const test = trySubscribe;
export const get = Source.get as typeof Public.get;
export const set = Source.set as typeof Public.set;
export const ref = Source.ref as typeof Public.ref;
export const use = Source.use as typeof Public.use;
export const event = Source.event as typeof Public.event;
export const Controller = Source.Controller as unknown as typeof Public.Controller;
export const Singleton = Source.Singleton as unknown as typeof Public.Singleton;
export const Provider = Source.Provider as unknown as Public.Provider;
export default Controller;

type Class = new(...args: any[]) => any;

interface RenderControllerResult<T> 
  extends RenderHookResult<unknown, T> {
  /** Reference to controller instance. */
  state: T;
  /** Check if rerender was requested. Will reject if not. */
  assertDidUpdate(): Promise<void>
  /** Assert a rerender was not requested. Will reject if one was. */
  assertDidNotUpdate(): Promise<void>
}

interface TestConsumerProps
  <T extends typeof Controller>{
  of: T; 
  get: { 
    [P in keyof InstanceType<T>]?: jest.Mock 
  }
}

/**
 * Helper component will pull specified VC from context,
 * and pull values for analysis.
 */
export function Consumer<T extends typeof Controller>
  ({ of: Subject, get }: TestConsumerProps<T>){

  const instance = Subject.get();

  for(const key in get){
    const callback = get[key]!;
    callback(instance[key]);
  }

  return null;
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

    let trace = stack.map(line => {
      const match = STACK_FRAME.exec(line) || [] as string[];
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

function mockPropertyAccess(
  on: any, properties: string[]){

  for(const property of properties){
    let x: any = on;
    for(const key of property.split("."))
      x = x[key];
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
  init: typeof Public.Controller | (() => Public.Controller),
  watch?: string[]
){
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

function plusUpdateAssertions(
  render: RenderHookResult<any, any>
){
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