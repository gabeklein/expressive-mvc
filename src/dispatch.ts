import { Controller, within } from './controller';
import { ManagedProperty } from './managed';
import { OBSERVER, Observer } from './observer';
import { PeerController } from './peers';
import { define } from './util';

type UpdatesEventHandler = (observed: {}, updated: string[]) => void;

export class ControllerDispatch 
  extends Observer<Controller> {

  static applyTo(control: Controller){
    let dispatch = control[OBSERVER];
  
    if(!dispatch){
      dispatch = new ControllerDispatch(control);
  
      dispatch.monitorValues(["get", "set"]);
      dispatch.monitorComputed(["Provider", "Input", "Value"]);
  
      define(control, {
        get: control,
        set: control
      })
  
      if(control.didCreate)
        control.didCreate();
    }
    
    return dispatch;
  }

  protected monitorValue(key: string, value: any){
    if(value instanceof PeerController)
      this.subject.attach(key, value.type)
    else if(value instanceof ManagedProperty)
      this.monitorManaged(key, value)
    else
      super.monitorValue(key, value)
  }

  private monitorManaged(key: string, value: ManagedProperty){
    const { create, initial } = value;
    const { state } = this;

    function generate(value: {}){
      //TODO enforce type
      const saved = state[key] = create() as Controller;
      Object.assign(saved, value);
      ControllerDispatch.applyTo(saved);
    }

    if(initial)
      generate(initial)
    else
      state[key] = undefined;

    this.manage(key, (value: any) => {
      if(!value)
        state[key] = undefined
      else if(typeof value == "object")
        generate(value)
      else
        throw new Error("Cannot assign a non-object to this property; it is managed.")
      
      this.pending.add(key);
      this.update();
    })
  }
  
  public pick(keys?: string[]){
    const acc = {} as BunchOf<any>;

    if(keys){
      for(const key of keys)
        acc[key] = within(this.subject, key);

      return acc;
    }

    for(const key in this){
      const desc = Object.getOwnPropertyDescriptor(this, key);

      if(!desc)
        continue;

      if(desc.value !== undefined)
        acc[key] = desc.value;
    }

    for(const key in this.subscribers)
      acc[key] = this.state[key];

    return acc;
  }

  public feed(
    keys: string[],
    observer: UpdatesEventHandler,
    fireInitial?: boolean){

    const pending = new Set<string>();

    const callback = () => {
      const acc = {} as any;

      for(const k of keys)
        acc[k] = this.state[k];

      observer.call(this.subject, acc, Array.from(pending));
      pending.clear();
    };

    const onDone = this.addMultipleListener(keys, (key) => {
      if(!pending.size)
        setTimeout(callback, 0);

      pending.add(key);
    });

    if(fireInitial)
      callback();

    return onDone;
  }

  protected computedDidFail(property: string, early = false){
    const parent = this.subject.constructor.name;

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
}