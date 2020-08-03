import { renderHook, RenderHookResult } from '@testing-library/react-hooks';

import { getSubscriber, SUBSCRIPTION } from '../src/subscription';

type Class = new (...args: any[]) => any;
type Initializer = () => any;

function ensureArray<T>(x: T | T[]){
  return ([] as T[]).concat(x);
}

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
 * Test-definition, activate Controller hook on a given class.
 */
interface TestSuite<T extends Class> {
  /** Activate controller. Passes `args` to constructor */
  use?: T;
  /** forward these arguments to the activated method */
  args?: any[];

  /** Subscribe to this, plus whatever automatic inference finds */
  on?: string | string[];
  /** Don't subscribe to this, despite automatic inference */
  not?: string | string[];
  /** Only subscribe to this, override automatic inference */
  only?: string | string[];
  /** Disable automatic inference */
  once?: true;

  /** 
   * Access these properties on first render; 
   * this simulates a destructure so automatic 
   * subscription can infer what to watch. 
   */
  peek?: string | string[];
}

/**
 * Test a ModelController with this. Equivalent to `renderHook`, 
 * however for controller hooks.
 * 
 * Pass in object with desired hook, and an applicable class as it's value. 
 * 
 * Except for `use`, given class must extend `Controller`
 * 
 * e.g. `{ use: TestController }`
 * 
 * `peek` simulates access on first render.
 * 
 * `args` passes arguments to `Controller.use()`
 * 
 * Available Hooks:
 * - use
 * 
 * Refresh Directives:
 * - on
 * - only
 * - not
 * - once
 */
export function trySubscribe<T extends Class>(config: TestSuite<T>): RenderControllerResult<InstanceType<T>>
export function trySubscribe<T>(init: () => T): RenderControllerResult<T>
export function trySubscribe(config: TestSuite<any> | Initializer){
  let init: Initializer;

  if(typeof config === "function")
    init = config;

  else {
    const Model = config.use;

    if(!Model)
      throw new Error(`\`use: Controller\` not specified in test suite!`);

    init = () => Model.use();
    init = adjustSubscription(init, config);

    if(config.peek)
      init = mockPropertyAccess(init, config.peek);
  }

  let api = renderHook(init);
  
  return plusUpdateAssertions(api);
}

function mockPropertyAccess(
  chain: Initializer, 
  vars: string | string[] ){

  return () => {
    const ref = chain();

    for(const key of ensureArray(vars))
      void ref[key]; 

    getSubscriber(ref).start();
    return Object.getPrototypeOf(ref);
  }
}

function adjustSubscription(
  chain: Initializer, 
  { once, only, on, not }: TestSuite<any>){

  if(once)
    return () => chain().once();
  else if(only)
    return () => chain().only(...ensureArray(only))
  else {
    if(on){
      const link = chain;
      chain = () => link().on(...ensureArray(on))
    }
    if(not)
      return () => chain().not(...ensureArray(not))
    else
      return chain;
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
  const { current } = patched.result;

  patched.state = SUBSCRIPTION in current ? Object.getPrototypeOf(current) : current;

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