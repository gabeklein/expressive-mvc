import { Model } from '..';
import { mockAsync } from '../../tests/adapter';
import { Oops as Util } from '../util';
import { set } from './set';

describe("placeholder", () => {
  class Test extends Model {
    foobar = set<string>();
  }

  it('will suspend if value is accessed before assign', async () => {
    const instance = Test.create();
    const promise = mockAsync<string>();
    const mockEffect = jest.fn((state: Test) => {
      promise.resolve(state.foobar);
    });

    instance.effect(mockEffect);

    expect(mockEffect).toBeCalledTimes(1);

    instance.foobar = "foo!";

    const result = await promise.pending();

    expect(mockEffect).toBeCalledTimes(2);
    expect(result).toBe("foo!");
  })
  
  it('will not suspend if value is defined', async () => {
    const instance = Test.create();

    instance.foobar = "bar!";

    const mockEffect = jest.fn((state: Test) => {
      expect(state.foobar).toBe("bar!");
    });

    instance.effect(mockEffect);
    expect(mockEffect).toBeCalledTimes(1);
  })
})

describe("callback", () => {
  it('will invoke callback on property put', async () => {
    class Subject extends Model {
      test = set<number>(value => {
        callback(value + 1);
      });
    }

    const state = Subject.create();
    const callback = jest.fn()
    const event = jest.fn();

    expect(callback).not.toBeCalled();
    state.on("test", event, true);

    state.test = 1;
    expect(callback).toBeCalledWith(2);

    await state.update(true)
    expect(event).toBeCalledWith(1, "test");
  })

  it('will invoke return-callback on overwrite', async () => {
    class Subject extends Model {
      test = set<number>(() => {
        return () => {
          callback(true);
        }
      });
    }

    const callback = jest.fn()
    const state = Subject.create();

    state.test = 1;

    await state.update(true);
    expect(callback).not.toBeCalled();
    state.test = 2;

    await state.update(true);
    expect(callback).toBeCalledWith(true);
  })

  it('will assign a default value', async () => {
    class Subject extends Model {
      test = set("foo", value => {
        callback(value);
      });
    }

    const callback = jest.fn()
    const state = Subject.create();

    expect(state.test).toBe("foo");
    state.test = "bar";

    await state.update();
    expect(callback).toBeCalledWith("bar");
  })

  it('will ignore effect promise', () => {
    class Subject extends Model {
      property = set<any>(undefined, async () => {});
    }

    const state = Subject.create();

    expect(() => state.property = "bar").not.toThrow();
  })

  it('will throw on bad effect return', () => {
    class Subject extends Model {
      // @ts-ignore
      property = set<any>(undefined, () => 3);
    }

    const expected = Util.BadCallback();
    const state = Subject.create();

    expect(() => state.property = "bar").toThrow(expected);
  })
})

describe("intercept", () => {
  it('will prevent update if callback returns false', async () => {
    class Subject extends Model {
      test = set("foo", value => {
        callback(value);
        return false;
      });
    }

    const callback = jest.fn()
    const state = Subject.create();

    expect(state.test).toBe("foo");
    state.test = "bar";

    await state.update(false);
    expect(callback).toBeCalledWith("bar");
    expect(state.test).toBe("foo");
  })

  it('will block value if callback returns true', async () => {
    class Subject extends Model {
      test = set("foo", value => true);
    }

    const state = Subject.create();

    expect(state.test).toBe("foo");
    state.test = "bar";

    await state.update(true);
    expect(state.test).toBe("foo");
  })
})