import { Model } from '../model';
import { ref, Oops } from './ref';

describe("property", () => {
  it('will fetch value from ref-object', async () => {
    class Subject extends Model {
      ref = ref<string>();
    }

    const state = Subject.new();
  
    state.ref.current = "foobar";
  
    await expect(state).toUpdate();
    expect(state.ref.current).toBe("foobar");
  })
  
  it('will watch "current" of property', async () => {
    class Subject extends Model {
      ref = ref<string>();
    }

    const state = Subject.new();
    const callback = jest.fn()
  
    state.on("ref", callback, true);
    state.ref.current = "foobar";
  
    await expect(state).toUpdate();
    expect(callback).toBeCalledWith(["ref"]);
  })
  
  it('will update "current" when property invoked', async () => {
    class Subject extends Model {
      ref = ref<string>();
    }

    const state = Subject.new();
    const callback = jest.fn()
  
    state.on("ref", callback, true);
    state.ref("foobar");
  
    await expect(state).toUpdate();
    expect(callback).toBeCalledWith(["ref"]);
  })
  
  it('will invoke callback', async () => {
    const didTrigger = jest.fn();
    const didUpdate = jest.fn();

    class Subject extends Model {
      ref = ref<string>(didTrigger);
    }

    const state = Subject.new();
  
    expect(didTrigger).not.toBeCalled();
    state.on("ref", didUpdate, true);
    state.ref.current = "foobar";
    expect(didTrigger).toBeCalledWith("foobar");
  
    await expect(state).toUpdate();
    expect(didUpdate).toBeCalledWith(["ref"]);
  })
  
  it('will invoke return-callback on overwrite', async () => {
    class Subject extends Model {
      ref = ref<number>(() => didTrigger);
    }

    const state = Subject.new();
    const didTrigger = jest.fn();
  
    state.ref.current = 1;
  
    await expect(state).toUpdate();
    expect(didTrigger).not.toBeCalled();
    state.ref.current = 2;
  
    await expect(state).toUpdate();
    expect(didTrigger).toBeCalled();
  })

  it('will not callback when gets null', async () => {
    const callback = jest.fn()

    class Subject extends Model {
      ref = ref<string>(callback);
    }

    const state = Subject.new();

    state.ref(null);
    expect(callback).not.toBeCalled();
  });

  it('will callback when on null if ignore false', async () => {
    const callback = jest.fn()

    class Subject extends Model {
      ref = ref<string>(callback, false);
    }

    const state = Subject.new();

    state.ref(null);
    expect(callback).toBeCalledWith(null);
  });

  it('will export value of ref-properties', () => {
    class Subject extends Model {
      ref = ref<string>();
    }

    const test = Subject.new();
    const values = { ref: "foobar" }
  
    test.ref(values.ref);
  
    expect(test.get()).toMatchObject(values);
  })
  
  it('will be accessible from a proxy', () => {
    class Subject extends Model {
      ref = ref<string>()
    }

    const test = Subject.new();
  
    test.on(state => {
      expect(state.ref).not.toBeUndefined();
    })
  })
})

describe("proxy", () => {
  class Subject extends Model {
    foo = "foo";
    bar = "bar";

    refs = ref(this);
  }

  it("will match properties", () => {
    const test = Subject.new();

    for(const key in test)
      expect(test.refs).toHaveProperty(key);
  })

  it("will match values via current", () => {
    const test = Subject.new();
    const { refs } = test;

    for(const key in test){
      const value = (test as any)[key];
      const { current } = (refs as any)[key];

      expect(current).toBe(value);
    }
  })

  it("will update values", async () => {
    const test = Subject.new();

    expect(test.foo).toBe("foo");
    expect(test.bar).toBe("bar");

    test.refs.foo("bar");
    test.refs.bar("foo");

    await expect(test).toUpdate();

    expect(test.foo).toBe("bar");
    expect(test.bar).toBe("foo");
  })
})

describe("mapped", () => {
  const generateRef = jest.fn((key: any) => key as string);

  class Test extends Model {
    foo = "foo";
    bar = "bar";
    
    fields = ref(this, generateRef);
  }

  afterEach(() => {
    generateRef.mockClear();
  })

  it("will run function for accessed keys", () => {
    const { fields } = Test.new();

    expect(fields.foo).toBe("foo");
    expect(fields.bar).toBe("bar");

    expect(generateRef).toBeCalledWith("foo");
    expect(generateRef).toBeCalledWith("bar");
  })

  it("will run function only for accessed property", () => {
    const { fields } = Test.new();

    expect(fields.foo).toBe("foo");

    expect(generateRef).toBeCalledWith("foo");
    expect(generateRef).not.toBeCalledWith("bar");
  })

  it("will run function only once per property", () => {
    const { fields } = Test.new();

    expect(fields.foo).toBe("foo");
    expect(fields.foo).toBe("foo");

    expect(generateRef).toBeCalledTimes(1);
  })

  it("will throw if object is not this", () => {
    class Test extends Model {
      foo = "foo";
      bar = "bar";
      
      // @ts-expect-error
      fields = ref({});
    }

    expect(() => Test.new()).toThrowError(Oops.BadRefObject());
  })
})