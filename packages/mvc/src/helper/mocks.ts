import { Control } from "../control";
import { Model } from "../model";

const newModel = Model.new;

type Callback = () => void;

let current: Model | undefined;
let mount: (() => typeof unmount) | void;
let hook: Callback | undefined;
let unmount: Callback | void;

afterEach(() => {
  if(unmount)
    unmount();

  current = undefined;
  hook = undefined;
  memo = undefined;
  unmount = undefined;
});

let memo: any;

function useMemo<T>(factory: () => T){
  return memo || (memo = factory());
}

Model.new = function(){
  return current = newModel.call(this);
}

Control.tapModel = (Type, memo) => {
  return useMemo(() => memo(current));
}

Control.hasModel = (Type, subject, callback) => {
  callback(current);
}

Control.getModel = (_type, adapter) => {
  return useMemo(() => {
    const result = adapter(hook!, use => use(current));

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