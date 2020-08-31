import { Observer } from './observer';
import { PeerController } from './peers';
import { within } from './util';

type UpdatesEventHandler = (observed: {}, updated: string[]) => void;

export class ControllerDispatch extends Observer {

  protected monitorValue(key: string, value: any){
    if(value instanceof PeerController)
      this.subject.attach(key, value.type)
    else
      super.monitorValue(key, value)
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

    const release = this.addMultipleListener(keys, (key) => {
      if(!pending.size)
        setTimeout(callback, 0);

      pending.add(key);
    });

    if(fireInitial)
      callback();

    return release;
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