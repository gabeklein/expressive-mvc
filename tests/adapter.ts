import { renderHook, RenderHookResult } from '@testing-library/react-hooks';

import Controller, { use } from '../';

type Class = new (...args: any[]) => any;

const HOOK_METHODS = [ "use", "get" ];

function ensureArray<T>(x: T | T[]){
  return ([] as T[]).concat(x);
}

/**
 * Error with test-friendlier stack-trace. 
 * 
 * Create prior to running an async operation. 
 * Throwing this as a closure-variable highlights the failed promise.
 */
class TraceableError extends Error {
  constructor(message: string){
    super(message);
    const stack = (this.stack as string).split(/\n/);
    this.stack = [ stack[0], stack[3] ].join("\n");
  }
}

/**
 * Test-definition, activate Controller hook on a given class.
 */
interface TestSuite<T> {
  /** Activate controller. Passes `args` to constructor */
  use?: T;
  /** Capture controller from context.*/
  pull?: T;

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
 * - get
 * 
 * Refresh Directives:
 * - on
 * - only
 * - not
 * - once
 */
export function trySubscribe<T extends Class>(config: TestSuite<T>): RenderControllerResult<InstanceType<T>>
export function trySubscribe<T>(init: () => T): RenderControllerResult<T>
export function trySubscribe(config: TestSuite<any> | Function){
  let init: Function | undefined;

  if(typeof config === "function")
    init = config;
  else {
    init = appliedMethod(config);
    init = applySubscription(init, config);
    init = mockPropertyAccess(init, config);
  }

  const api = renderHook(init as any);
  addExtraAssertions(api as any);
  return api;
}

function appliedMethod(config: TestSuite<any>){
  for(const key of HOOK_METHODS){
    const Definition = (config as any)[key];
    if(!Definition)
      continue;

    if(Definition.prototype instanceof Controller === false)
      if(key === "use")
        return () => use(config.use)
      else
        throw new Error(`Controller of type ${Definition.name} does not extend Controller!`)
    
    return () => (Controller as any)[key].apply(Definition, config.args);
  }
  throw new Error(`No hook specified in test suite!`);
}

function mockPropertyAccess(
  chain: Function, 
  { peek }: TestSuite<any> ){
    
  if(!peek) return chain;

  return () => {
    const ref = chain();
    const keys = ensureArray(peek);
    for(const key of keys)
      void ref[key];
    return ref;
  }
}

function applySubscription(
  chain: Function, 
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

  /** 
   * Controller reference never actually changes. 
   * Is destructure safe techincally. 
   * */
  state: T;

  /** Check if rerender was requested. Will reject if not. */
  assertDidUpdate(): Promise<void>

  /** Assert a rerender was not requested. Will reject if one was. */
  assertDidNotUpdate(): Promise<void>
}

function addExtraAssertions(
  append: RenderControllerResult<any>){

  append.state = append.result.current;

  append.assertDidUpdate = () => {
    const error = new TraceableError("Assertion failed: hook did not update");
    let done = false;

    return Promise.race([
      append.waitForNextUpdate(),
      new Promise<never>((resolve) => {
        setTimeout(() => { 
          if(!done) 
            throw error
        }, 500)
      })
    ]).then(() => {
      done = true
    })
  }

  append.assertDidNotUpdate = () => {
    const error = new TraceableError("Assertion failed: hook did update")
    let done = false;

    return Promise.race([
      append.waitForNextUpdate().then(() => {
        if(!done) throw error;
      }),
      new Promise<void>((resolve) => {
        setTimeout(() => {
          done = true;
          resolve();
          append.rerender();
        }, 500)
      })
    ])
  }
}