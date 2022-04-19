import { Model } from './adapter';

describe("built-in", () => {
  it('calls `didCreate` when initialized', () => {
    class Subject extends Model {
      didCreate(){
        mock(this);
      }
    }

    const mock = jest.fn();
    const test = Subject.create();

    expect(mock).toHaveBeenCalledWith(test);
  })

  it('calls `willDestroy` will when killed', () => {
    class Subject extends Model {
      willDestroy(){
        mock(this);
      }
    }

    const mock = jest.fn();
    const test = Subject.create();

    test.destroy();

    expect(mock).toHaveBeenCalledWith(test);
  })
})