import { Control } from "../control";
import { Model } from "../model";

const newModel = Model.new;

let current: Model | undefined;
let getter: (() => any) | undefined;
let mount: (() => typeof unmount) | void;
let render: (() => void) | undefined;
let unmount: (() => void) | void;

afterEach(() => {
  if(unmount)
    unmount();

  current = undefined;
  getter = undefined;
  render = undefined;
  unmount = undefined;
})

Model.new = function(){
  return current = newModel.call(this);
}

Control.hasModel = (Type, required) => {
  return got => {
    if(current)
      got(current as any);
    else if(required !== false)
      throw new Error(`Could not find ${Type} in context.`)
  }
}

Control.getModel = (_type, adapter) => {
  if(!getter){
    const result = adapter(render!, use => use(current as any));

    if(!result){
      getter = () => null;
      return null;
    }

    getter = result.render;
    mount = result.commit;
  }

  return getter();
}

export function renderHook<T>(hook: () => T){
  let willRender = () => {};

  const mock = {
    mock: jest.fn(hook),
    current: undefined as T,
    refresh: Promise.resolve(),
    pending: false
  }

  render = () => {
    try {
      mock.pending = false;
      willRender();
      mock.current = mock.mock();
    }
    catch(error){
      if(!(error instanceof Promise))
        throw error;

      mock.pending = true;
      error.then(render).finally(() => {
        mock.pending = false;
      });
    }
    finally {
      mock.refresh = new Promise(res => willRender = res);

      if(mount){
        unmount = mount();
        mount = undefined;
      }
    }
  }

  render();

  return mock;
}