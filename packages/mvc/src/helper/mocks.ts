import { Context } from "../context";
import { Control } from "../control";

export const context = new Context();

let invoke: (() => void) | undefined;
let memo: any;
let mount: (() => typeof unmount) | void;
let unmount: (() => void) | void;

afterEach(() => {
  if(unmount)
    unmount();

  context.pop();

  memo = undefined;
  invoke = undefined;
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

  return memo || (memo = factory(invoke!));
}

interface MockHook<T> extends jest.Mock<T, []> {
  output: T;
  pending: boolean;
  didUpdate(): Promise<void>;
  update(next: () => T): Promise<void>;
  unmount(): void;
}

export function render<T>(hook: () => T){
  let willRender = () => {};
  let waiting: Promise<void>;

  const mock: MockHook<T> = Object.assign(
    jest.fn(() => hook()), {
      output: undefined as T,
      pending: false,
      didUpdate(){
        return waiting;
      },
      update(next: () => T){
        hook = next;
        invoke!();
        return waiting;
      },
      unmount(){
        if(unmount)
          unmount();
      }
    }
  )

  invoke = () => {
    try {
      mock.pending = false;
      willRender();
      mock.output = mock();
    }
    catch(error){
      if(!(error instanceof Promise))
        throw error;

      mock.pending = true;
      error.then(invoke).finally(() => {
        mock.pending = false;
      });
    }
    finally {
      waiting = new Promise(res => willRender = res);

      if(mount){
        unmount = mount();
        mount = undefined;
      }
    }
  }

  invoke();

  return mock;
}