import { Controller } from "./adapter";

describe("built-in", () => {
  it('calls `didCreate` when initialized', () => {
    class Subject extends Controller {
      didCreate(){
        mock(this);
      }
    }

    const mock = jest.fn();
    const instance = Subject.create();

    expect(mock).toHaveBeenCalledWith(instance);
  })

  it('calls `willDestroy` will when killed', () => {
    class Subject extends Controller {
      willDestroy(){
        mock(this);
      }
    }

    const mock = jest.fn();
    const instance = Subject.create();

    instance.destroy();

    expect(mock).toHaveBeenCalledWith(instance);
  })
})