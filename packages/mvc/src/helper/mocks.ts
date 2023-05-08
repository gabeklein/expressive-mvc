import { Context } from "../context";
import { Control } from "../control";

export const context = new Context();

let hook: (() => void) | undefined;
let memo: any;
let mount: (() => typeof unmount) | void;
let unmount: (() => void) | void;

afterEach(() => {
  if(unmount)
    unmount();

  context.pop();

  hook = undefined;
  memo = undefined;
  unmount = undefined;
});

beforeAll(() => {
  Control.has = (Type, subject, callback) => {
    callback(context.get(Type));
  }

  Control.get = (Type, adapter) => {
    const render = useMemo(refresh => {
      const result = adapter(refresh, use => use(context.get(Type)));
  
      if(!result)
        return () => null
  
      mount = result.mount;
      return result.render;
    });
    
    return render();
  }
  
  Control.use = (adapter) => {
    return useMemo(refresh => {
      const result = adapter(refresh);
      
      mount = result.mount;
      return result.render;
    });
  }
})

function useMemo<T>(
  factory: (refresh: () => void) => T){

  return memo || (memo = factory(hook!));
}

export function render<T>(fn: () => T){
  let willRender = () => {};

  const result = {
    mock: jest.fn(() => fn()),
    current: undefined as T,
    refresh: Promise.resolve(),
    pending: false,
    update(implementation: () => T){
      fn = implementation;
      hook!();
      return this.refresh;
    },
    unmount(){
      if(unmount)
        unmount();
    }
  }

  hook = () => {
    try {
      result.pending = false;
      willRender();
      result.current = result.mock();
    }
    catch(error){
      if(!(error instanceof Promise))
        throw error;

      result.pending = true;
      error.then(hook).finally(() => {
        result.pending = false;
      });
    }
    finally {
      result.refresh = new Promise(res => willRender = res);

      if(mount){
        unmount = mount();
        mount = undefined;
      }
    }
  }

  hook();

  return result;
}