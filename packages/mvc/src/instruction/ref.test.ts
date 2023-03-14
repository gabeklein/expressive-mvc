import { Model } from '../model';
import { ref } from './ref';

describe("property", () => {
  class Subject extends Model {
    didTrigger = jest.fn();
  
    ref1 = ref<string>();
  
    ref2 = ref<symbol>(value => {
      this.didTrigger(value);
    })
  
    ref3 = ref<number>(() => {
      return () => {
        this.didTrigger(true);
      }
    })
  }
  
  it('will fetch value from ref-object', async () => {
    const state = Subject.new();
  
    state.ref1.current = "foobar";
  
    await state.on(true);
    expect(state.ref1.current).toBe("foobar");
  })
  
  it('will watch "current" of property', async () => {
    const state = Subject.new();
    const callback = jest.fn()
  
    state.on("ref1", callback, true);
    state.ref1.current = "foobar";
  
    await state.on(true);
    expect(callback).toBeCalledWith(["ref1"]);
  })
  
  it('will update "current" when property invoked', async () => {
    const state = Subject.new();
    const callback = jest.fn()
  
    state.on("ref1", callback, true);
    state.ref1("foobar");
  
    await state.on(true);
    expect(callback).toBeCalledWith(["ref1"]);
  })
  
  it('will invoke callback if exists', async () => {
    const state = Subject.new();
    const targetValue = Symbol("inserted object");
    const callback = jest.fn();
  
    expect(state.didTrigger).not.toBeCalled();
    state.on("ref2", callback, true);
    state.ref2.current = targetValue;
    expect(state.didTrigger).toBeCalledWith(targetValue);
  
    await state.on(true);
    expect(callback).toBeCalledWith(["ref2"]);
  })
  
  it('will invoke return-callback on overwrite', async () => {
    const state = Subject.new();
  
    state.ref3.current = 1;
  
    await state.on();
    expect(state.didTrigger).not.toBeCalled();
    state.ref3.current = 2;
  
    await state.on();
    expect(state.didTrigger).toBeCalledWith(true);
  })
  
  it('will export value of ref-properties', () => {
    const test = Subject.new();
    const values = {
      ref1: "foobar",
      ref2: Symbol("foobar"),
      ref3: 69420
    }
  
    test.ref1(values.ref1);
    test.ref2(values.ref2);
    test.ref3(values.ref3);
  
    const state = test.get();
  
    expect(state).toMatchObject(values);
  })
  
  it('will be accessible from a proxy', () => {
    const test = Subject.new();
  
    test.on(state => {
      expect(state.ref1).not.toBeUndefined();
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

    await test.on(true);

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
})