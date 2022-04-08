import { Controller } from './controller';
import { getController, LOCAL, Stateful, UPDATE } from './model';
import { create, define, defineLazy, defineProperty, getOwnPropertyDescriptor, setAlias } from './util';

type Listener = {
  commit(): void;
  release(): void;
}

export class Subscriber {
  public proxy: any;
  public source: any;
  public active = false;
  public watch = {} as BunchOf<Callback | true>;
  public dependant = new Set<Listener>();
  public parent: Controller;
  public notify?: RequestCallback;
  public release!: Callback;

  constructor(
    parent: Controller | Stateful,
    public onUpdate: Controller.Listen){

    if(!(parent instanceof Controller))
      parent = getController(parent);

    this.parent = parent;
    this.source = parent.subject;
    this.proxy = create(parent.subject);

    define(this.proxy, LOCAL, this);
    defineLazy(this.proxy, UPDATE, () => {
      const update: string[] = [];
  
      this.notify = keys => {
        update.splice(0, update.length,
          ...keys.filter(k => k in this.watch)  
        )
      }
  
      return update;
    });

    for(const key in parent.state)
      this.spy(key);
  }

  public spy(key: string){
    const { proxy } = this;
    const existing =
      getOwnPropertyDescriptor(this.source, key)!;

    const isUsing = () => {
      this.watch[key] = true;
      delete proxy[key];
      return proxy[key];
    }

    setAlias(isUsing, `tap ${key}`);
    defineProperty(proxy, key, {
      set: existing.set,
      get: isUsing,
      configurable: true,
      enumerable: true
    })
  }

  public commit(){
    const onDone =
      this.parent.addListener((key, source) => {
        const handler = this.watch[key];
    
        if(!handler)
          return;
    
        if(typeof handler == "function")
          handler();
    
        const notify = this.onUpdate(key, source);
    
        if(notify)
          source.waiting.add(notify);
        
        if(this.notify)
          source.waiting.add(this.notify);
      });

    this.active = true;
    this.dependant.forEach(x => x.commit());

    return this.release = () => {
      this.dependant.forEach(x => x.release());
      onDone();
    }
  }
}