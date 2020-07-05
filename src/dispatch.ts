import { Controller } from './controller';
import { ManagedProperty } from './managed';
import { Observer } from './observer';
import { PeerController } from './peers';
import { createSubscription, getSubscriber } from './subscription';
import { collectGetters, define, entriesOf, Set } from './util';

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
      onChange: this.onChange.bind(this),
      observe: this.observe.bind(this)
    })

    this.monitorValues();
    this.monitorComputed();

    if(control.didCreate)
      control.didCreate();
  }

  public forceRefresh(...watching: string[]){
    for(const x of watching)
      this.pending.add(x)
      
    this.update();
  }

  private monitorValues(){
    const { state, subject, subscribers } = this;
    
    for(const [key, desc] of entriesOf(subject)){
      if("value" in desc === false)
        continue;

      const value = desc.value;

      if(typeof value === "function" && /^[A-Z]/.test(key) == false)
        continue;

      if(["get", "set"].indexOf(key) >= 0)
        continue;
        
      if(value instanceof PeerController){
        value.attachNowIfGlobal(subject, key);
        continue;
      }

      subscribers[key] = new Set();

      Object.defineProperty(subject, key, {
        enumerable: true,
        configurable: false,
        get: () => state[key],
        set: value instanceof ManagedProperty 
          ? this.monitorRecursive(key, value)
          : this.monitorValue(key, value)
      })
    }
  }

  private monitorValue(key: string, initial: any){
    this.state[key] = initial;

    return (value: any) => {
      if(this.state[key] === value)
        if(!Array.isArray(value))
          return;
        
      this.state[key] = value;
      this.pending.add(key);
      this.update();
    }
  }
  
  private monitorRecursive(key: string, { create, initial }: ManagedProperty){
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

  private monitorComputed(){
    const { state, subscribers, subject } = this;
    const getters = collectGetters(subject, ["Provider", "Input", "Value"]);

    for(const [key, fn] of Object.entries(getters)){
      subscribers[key] = new Set();

      const getValueLazy = () => state[key];

      const setNotAllowed = () => {
        throw new Error(`Cannot set ${key} on this controller, it is computed.`) 
      }
  
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

      function initComputedValue(early?: true){
        try {
          const spy = createSubscription(subject, onValueDidChange);
          const value = state[key] = fn.call(spy);
          getSubscriber(spy).start();
          return value;
        }
        catch(err){
          const entity = subject.constructor.name;
          let warning = 
            `There was an attempt to access computed property ${entity}.${key} for the first time; ` +
            `however an exception was thrown. Expected data probably doesn't exist yet.`;

          if(early)
            warning += `\n` + 
              `Note: Computed are usually only calculated when first accessed, except when forced by "observe" or "export".` +
              `This property's getter may have run earlier than intended because of that.`

          console.warn(warning);
          throw err;
        }
        finally {
          Object.defineProperty(subject, key, {
            set: setNotAllowed,
            get: getValueLazy,
            enumerable: true,
            configurable: true
          })
        }
      }
  
      Object.defineProperty(subject, key, {
        set: setNotAllowed,
        get: initComputedValue,
        configurable: true
      })
    }
  }
}