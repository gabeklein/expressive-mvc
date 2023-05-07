import { Context } from "../context";
import { Control } from "../control";

type Callback = () => void;

export const context = new Context();

let hook: Callback | undefined;
let memo: any;
let mount: (() => typeof unmount) | void;
let unmount: Callback | void;

afterEach(() => {
  if(unmount)
    unmount();

  context.pop();

  hook = undefined;
  memo = undefined;
  unmount = undefined;
});

function useMemo<T>(factory: () => T){
  return memo || (memo = factory());
}

Control.tapModel = (Type, memo) => {
  return useMemo(() => memo(context.get(Type)));
}

Control.hasModel = (Type, subject, callback) => {
  callback(context.get(Type));
}

Control.getModel = (Type, adapter) => {
  return useMemo(() => {
    const result = adapter(hook!, use => use(context.get(Type)));

    if(!result)
      return () => null

    mount = result.commit;
    return result.render;
  })();
}

Control.useModel = (adapter, props) => {
  return useMemo(() => {
    const result = adapter(hook!);
    
    mount = result.commit;
    return result.render;
  })(props);
}

export function render<T>(fn: () => T){
  let willRender = () => {};

  const result = {
    mock: jest.fn(fn),
    current: undefined as T,
    refresh: Promise.resolve(),
    pending: false,
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