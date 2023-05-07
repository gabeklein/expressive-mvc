import { Control } from "../control";
import { Model } from "../model";

const newModel = Model.new;

type Callback = () => void;

let current: Model | undefined;
let mount: (() => typeof unmount) | void;
let render: Callback | undefined;
let unmount: Callback | void;

afterEach(() => {
  if(unmount)
    unmount();

  current = undefined;
  render = undefined;
  renderGet = undefined;
  renderTap = undefined;
  renderUse = undefined;
  unmount = undefined;
})

Model.new = function(){
  return current = newModel.call(this);
}

let renderTap: (() => any) | undefined;

Control.tapModel = (Type, memo) => {
  if(!renderTap){
    const value = memo(current as any);
    renderTap = () => value;
  }

  return renderTap();
}

Control.hasModel = (Type, required) => {
  return got => {
    if(current)
      got(current as any);
    else if(required !== false)
      throw new Error(`Could not find ${Type} in context.`)
  }
}

let renderGet: (() => any) | undefined;

Control.getModel = (_type, adapter) => {
  if(!renderGet){
    const result = adapter(render!, use => use(current as any));

    if(!result){
      renderGet = () => null;
      return null;
    }

    renderGet = result.render;
    mount = result.commit;
  }

  return renderGet();
}

let renderUse: ((props: any) => any) | undefined;

Control.useModel = (adapter, props) => {
  if(!renderUse){
    const result = adapter(render!);
    
    mount = result.commit;
    renderUse = result.render;
  }

  return renderUse(props);
}

export function mockHook<T>(hook: () => T){
  let willRender = () => {};

  const mock = {
    mock: jest.fn(hook),
    current: undefined as T,
    refresh: Promise.resolve(),
    pending: false,
    unmount(){
      if(unmount)
        unmount();
    }
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