import { Controller } from './controller';
import { ManagedProperty } from './managed';
import { Observer } from './observer';
import { PeerController } from './peers';
import { Subscription } from './subscription';
import { collectGetters, define, entriesOf } from './util';

export const DISPATCH = Symbol("controller_dispatch");

export function getDispatch(from: Controller){
  const dispatch = from[DISPATCH];

  if(!dispatch)
    throw new Error("Dispatch has not yet been created on this instance!");

  return dispatch;
}

export function ensureDispatch(control: any){
  const target = control as Controller;

  return target[DISPATCH] || new ControllerDispatch(control);
}

export class ControllerDispatch 
  extends Observer<Controller> {
  
  constructor(control: Controller){
    super(control);

    define(control, DISPATCH, this);
    define(control, {
      get: control,
      set: control,
      observe: this.observe.bind(this)
    })

    this.monitorValues(["get", "set"]);
    this.monitorComputedValues(["Provider", "Input", "Value"]);

    if(control.didCreate)
      control.didCreate();
  }

  public forceRefresh(...watching: string[]){
    for(const x of watching)
      this.pending.add(x)
      
    this.update();
  }

  private monitorValues(except: string[]){
    const { subject } = this;
    
    for(const [key, desc] of entriesOf(subject)){
      if("value" in desc === false)
        continue;

      const value = desc.value;

      if(typeof value === "function" && /^[A-Z]/.test(key) == false)
        continue;

      if(except.indexOf(key) >= 0)
        continue;
        
      if(value instanceof PeerController){
        value.attachNowIfGlobal(subject, key);
        continue;
      }

      this.makeObservable(key, 
        value instanceof ManagedProperty 
          ? this.monitorManaged(key, value)
          : this.monitorValue(key, value)  
      )
    }
  }
  
  private monitorManaged(key: string, value: ManagedProperty){
    const { create, initial } = value;
    const { state } = this;

    function generate(value: {}){
      const saved = state[key] = create();
      Object.assign(saved, value);
      ensureDispatch(saved);
    }

    if(initial)
      generate(initial)
    else
      state[key] = undefined;

    return (value: any) => {
      if(!value)
        state[key] = undefined
      else if(typeof value == "object")
        generate(value)
      else
        throw new Error("Cannot assign a non-object to this property; it is managed.")
      
      this.pending.add(key);
      this.update();
    }
  }

  private monitorComputedValues(except: string[]){
    const { subscribers, subject } = this;
    const getters = collectGetters(subject, except);

    for(const key in getters){
      const compute = getters[key];
      subscribers[key] = new Set();

      Object.defineProperty(subject, key, {
        configurable: true,
        set: throwNotAllowed(key),
        get: this.monitorComputedValue(key, compute)
      })
    }
  }

  private monitorComputedValue(key: string, fn: () => any){
    const { state, subscribers, subject } = this;

    subscribers[key] = new Set();

    const getValueLazy = () => state[key];

    const onValueDidChange = () => {
      const value = fn.call(subject);
      const subscribed = subscribers[key] || [];

      if(state[key] === value)
        return

      state[key] = value;
      this.pending.add(key);

      for(const onDidUpdate of subscribed)
        onDidUpdate();
    }

    function getStartingValue(early = false){
      try {
        const subscribe = new Subscription(subject, onValueDidChange);
        const value = state[key] = fn.call(subscribe.proxy);
        subscribe.start();
        return value;
      }
      catch(e){
        failedComputeHint(subject.constructor.name, key, early);
        throw e;
      }
      finally {
        Object.defineProperty(subject, key, {
          set: throwNotAllowed(key),
          get: getValueLazy,
          enumerable: true,
          configurable: true
        })
      }
    }

    isInitialCompute(getStartingValue, true);

    return getStartingValue;
  }
}

export function isInitialCompute(fn: any, set?: true){
  if(!set)
    return fn["initial"];
  else
    fn["initial"] = true;
}

function throwNotAllowed(key: string){
  return () => {
    throw new Error(`Cannot set ${key} on this controller, it is computed.`) 
  }
}

function failedComputeHint(
  parent: string, 
  property: string, 
  early: boolean){

  let warning = 
    `There was an attempt to access computed property ` + 
    `${parent}.${property} for the first time; however an ` +
    `exception was thrown. Dependant values probably don't exist yet.`;

  if(early)
    warning += `\n` + 
      `Note: Computed values are usually only calculated after first ` +
      `access, except where accessed implicitly by "on" or "export". Your ` + 
      `'${property}' getter may have run earlier than intended because of that.`

  console.warn(warning);
}