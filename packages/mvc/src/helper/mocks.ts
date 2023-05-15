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
  Control.has = _subject => got => {
    got(context);
  }

  Control.get = (adapter) => {
    return useMemo(refresh => {
      const result = adapter(refresh, context);
  
      if(!result)
        return () => null
  
      mount = result.mount;
      return result.render;
    })();
  }
  
  Control.use = (adapter) => {
    return useMemo(refresh => {
      const result = adapter(refresh);
      
      mount = result.mount;
      return result.render;
    });
  }
})

type DispatchFunction = (next: (tick: number) => number) => void;

function useMemo<T>(factory: (refresh: DispatchFunction) => T){
  if(!memoize){
    const refresh = attempt!;

    memoize = factory(dispatch => {
      dispatch(0);
      refresh();
    })
  }

  return memoize;
}

interface MockHook<T> extends jest.Mock<T, []> {
  output: T;
  pending: boolean;
  update(next?: () => T): Promise<void>;
  unmount(): void;
}

export function render<T>(impl: () => T){
  const mock = jest.fn(() => impl()) as MockHook<T>;

  let willRender = () => {};
  let waiting: Promise<void>;

  mock.unmount = () => {
    unmount && unmount();
    unmount = undefined;
  }
  mock.update = (next) => {
    if(next){
      impl = next;
      attempt!();
    }
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