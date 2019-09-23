import { renderHook, RenderHookResult } from '@testing-library/react-hooks';

import Controller, { use } from '../';

const HOOK_METHODS = [
  "use",
  "useOn",
  "useOnly",
  "useOnce",
  "useExcept",
  "get",
  "getOn",
  "getOnly",
  "getOnce",
  "getExcept"
]

function toArray<T>(x: T[] | T){
  return ([] as T[]).concat(x) as T[]
}

class PromiseError extends Error {
  constructor(message: string){
    super(message);
    const stack = (this.stack as string).split(/\n/);
    this.stack = [ stack[0], stack[3] ].join("\n");
  }
}

type Class = new (...args: any[]) => any;

interface ControllerHookTestable<T> 
  extends RenderHookResult<unknown, T> {

  /** Check if rerender was requested. Will reject if not. */
  assertDidUpdate(): Promise<void>

  /** Assert a rerender was not requested. Will reject if one was. */
  assertDidNotUpdate(): Promise<void>
}

/**
 * Test-definition, activate Controller hook on a given class.
 */
interface TestSuite<T> {
  /** Activate controller. Pass `args` to constructor */
  use?: T;
  /** Capture controller from context.*/
  get?: T;

  useOn?: T;
  useOnly?: T;
  useOnce?: T;
  useExcept?: T;

  getOn?: T;
  getOnly?: T;
  getOnce?: T;
  getExcept?: T;

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

  /** forward these arguments to the activated method */
  args?: any[];
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
 * Available Hooks:
 * - use
 * - useOn
 * - useOnly
 * - useOnce
 * - useExcept
 * - get
 * - getOn
 * - getOnly
 * - getOnce
 * - getExcept
 * 
 * Refresh Modifiers:
 * - on
 * - only
 * - not
 * - once
 * 
 */
export function trySubscriber<T extends Class>(config: TestSuite<T>): ControllerHookTestable<InstanceType<T>>
export function trySubscriber<T>(init: () => T): ControllerHookTestable<T>
export function trySubscriber<T extends Class>(config: TestSuite<T> | Function){

  type Out = ControllerHookTestable<InstanceType<T>>;

  let init: Function | undefined;

  if(typeof config === "function")
    init = config;
  else {
    init = appliedMethod(config);
    init = applySubscription(init, config);
    init = applyDestructure(init, config);
  }

  const api = renderHook(init as any) as Out;
  applyExtraAssertions(api);
  return api;
}

function appliedMethod(config: TestSuite<any>){
  for(const key of HOOK_METHODS){
    const handler = (config as any)[key];
    if(!handler)
      continue;

    if(handler.prototype instanceof Controller === false)
      if(key === "use")
        return () => use(config.use)
      else
        throw new Error(`Controller of type ${handler.name} does not extend Controller!`)
    
    return () => (<any>Controller)[key].apply(handler, config.args);
  }
  throw new Error(`No hook specified in test suite!`);
}

function applyDestructure(
  chain: Function, { peek }: TestSuite<any> ){
    
  if(peek){
    const link = chain;
    const keys = toArray(peek);
    chain = () => {
      const reference = link();
      for(const key of keys)
        void reference[key];
      return reference;
    }
  }
  return chain;
}

function applySubscription(
  chain: Function, suite: TestSuite<any>){

  if(suite.once){
    const link = chain;
    chain = () => link().once();
  }
  else if(suite.only){
    const link = chain;
    const list = toArray(suite.only)
    chain = () => link().only(...list)
  }
  else {
    if(suite.not){
      const link = chain;
      const list = toArray(suite.not)
      chain = () => link().not(...list)
    }
    if(suite.on){
      const link = chain;
      const list = toArray(suite.on);
      
      chain = () => link().on(...list)
    }
  }
  return chain;
}

function applyExtraAssertions(hook: ControllerHookTestable<any>){
  hook.assertDidUpdate = () => {
    const error = new PromiseError("Assertion failed: hook did not update");
    let done = false;

    return Promise.race([
      hook.waitForNextUpdate(),
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
  
  hook.assertDidNotUpdate = () => {
    const error = new PromiseError("Assertion failed: hook did update")
    let done = false;

    return Promise.race([
      hook.waitForNextUpdate().then(() => {
        if(!done) throw error;
      }),
      new Promise<void>((resolve) => {
        setTimeout(() => {
          done = true;
          resolve();
          hook.rerender();
        }, 500)
      })
    ])
  }
}