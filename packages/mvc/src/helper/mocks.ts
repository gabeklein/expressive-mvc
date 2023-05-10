import { Context } from "../context";
import { Control } from "../control";

export const context = new Context();

let attempt: (() => void) | undefined;
let memoize: any;
let mount: (() => typeof unmount) | void;
let unmount: (() => void) | void;

afterEach(() => {
  if(unmount)
    unmount();

  context.pop();

  memoize = undefined;
  attempt = undefined;
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

  return memoize || (memoize = factory(attempt!));
}

interface MockHook<T> extends jest.Mock<T, []> {
  output: T;
  pending: boolean;
  didUpdate(): Promise<void>;
  update(next: () => T): Promise<void>;
  unmount(): void;
}

export function render<T>(impl: () => T){
  let willRender = () => {};
  let waiting: Promise<void>;

  const mock = jest.fn(() => impl()) as MockHook<T>;

  mock.didUpdate = () => waiting;
  mock.unmount = () => unmount && unmount();
  mock.update = (next) => {
    impl = next;
    attempt!();
    return waiting;
  }

  attempt = () => {
    try {
      mock.pending = false;
      willRender();
      mock.output = mock();
    }
    catch(error){
      if(!(error instanceof Promise))
        throw error;

      mock.pending = true;
      error.then(attempt).finally(() => {
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

  attempt();

  return mock;
}