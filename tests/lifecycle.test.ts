import { Model } from "./adapter";

describe("built-in", () => {
  it('calls `didCreate` when initialized', () => {
    class Subject extends Model {
      didCreate(){
        mock(this);
      }
    }

    const mock = jest.fn();
    const instance = Subject.create();

    expect(mock).toHaveBeenCalledWith(instance);
  })

  it('calls `willDestroy` will when killed', () => {
    class Subject extends Model {
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