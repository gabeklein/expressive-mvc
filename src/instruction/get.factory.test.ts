import { Model } from '..';
import { mockAsync, mockConsole } from '../helper/testing';
import { get, Oops } from './get';
import { Oops as Compute } from './get.factory';

const { warn } = mockConsole();

jest.setTimeout(60000000)

it("will compute when accessed", () => {
  const factory = jest.fn(() => "Hello World");

  class Test extends Model {
    value = get(factory);
  }

  const test = Test.new();

  expect(factory).not.toBeCalled();

  void test.value;

  expect(factory).toBeCalled();
})

it("will compute lazily", () => {
  const factory = jest.fn(async () => "Hello World");

  class Test extends Model {
    value = get(factory, false);
  }

  Test.new();

  expect(factory).not.toBeCalled();
})

it('will bind factory function to self', async () => {
  class Test extends Model {
    // methods lose implicit this
    value = get(this.method);

    async method(){
      expect(this).toBe(instance);
    }
  }

  const instance = Test.new();
})

it("will emit when factory resolves", async () => {
  class Test extends Model {
    value = get(async () => "foobar");
  }

  const test = Test.new();

  expect(() => test.value).toThrow(expect.any(Promise));

  await test.on("value");

  expect(test.value).toBe("foobar");
})

it("will not suspend where already resolved", async () => {
  class Test extends Model {
    greet = get(async () => "Hello");
    name = get(async () => "World");

    value = get(() => this.greet + " " + this.name);
  }

  const test = Test.new();

  await test.on("value");

  expect(() => test.value).not.toThrow();
})

it("will throw suspense-promise resembling an error", () => {
  const promise = mockAsync();

  class Test extends Model {
    value = get(promise.pending);
  }

  const instance = Test.new();
  const exprected = Compute.NotReady(instance, "value");

  expect(() => instance.value).toThrowError(exprected);
  promise.resolve();
})

it("will return undefined if not required", async () => {
  const promise = mockAsync<string>();
  const mock = jest.fn();

  class Test extends Model {
    value = get(promise.pending, false);
  }

  const test = Test.new();

  test.on(state => mock(state.value));
  expect(mock).toBeCalledWith(undefined);

  promise.resolve("foobar");
  await test.on();

  expect(mock).toBeCalledWith("foobar");
})

it("will warn and rethrow error from factory", () => {
  class Test extends Model {
    memoized = get(this.failToGetSomething, true);

    failToGetSomething(){
      throw new Error("Foobar") 
    }
  }

  const failed = Oops.ComputeFailed(Test.name, "memoized");

  expect(() => Test.new()).toThrowError("Foobar");
  expect(warn).toBeCalledWith(failed.message);
})

it("will suspend another factory", async () => {
  const greet = mockAsync<string>();
  const name = mockAsync<string>();

  const didEvaluate = jest.fn(
    (_key: string, $: Test) => {
      return $.greet + " " + $.name;
    }
  );

  class Test extends Model {
    greet = get(greet.pending);
    name = get(name.pending);

    value = get(didEvaluate);
  }

  const test = Test.new();

  test.on($ => void $.value);

  greet.resolve("Hello");
  await test.on();

  name.resolve("World");
  await test.on();

  expect(didEvaluate).toBeCalledTimes(3);
  expect(didEvaluate).toHaveReturnedWith("Hello World");
})

it("will suspend another factory (async)", async () => {
  const greet = mockAsync<string>();
  const name = mockAsync<string>();

  const didEvaluate = jest.fn(
    async (_key: string, $: Test) => {
      return $.greet + " " + $.name;
    }
  );

  class Test extends Model {
    greet = get(greet.pending);
    name = get(name.pending);
    value = get(didEvaluate);
  }

  const test = Test.new();

  test.on($ => void $.value);

  greet.resolve("Hello");
  await test.on();

  name.resolve("World");
  await test.on();

  expect(didEvaluate).toBeCalledTimes(3);
  expect(test.value).toBe("Hello World");
})

it("will throw if missing factory", () => {
  class Test extends Model {
    // @ts-ignore
    value = get(this);
  }

  const test = Test.new();

  expect(() => test.value).toThrowError(
    "Factory argument cannot be undefined"
  );
})

it("will nest suspense", async () => {
  class Child extends Model {
    value = get(promise.pending);
  }

  class Test extends Model {
    child = new Child();
    
    childValue = get(() => this.getChildValue);

    getChildValue(){
      return this.child.value + " world!";
    }
  }

  const promise = mockAsync<string>();
  const didUpdate = mockAsync<string>();

  const test = Test.new();
  const effect = jest.fn((state: Test) => {
    // should suspend here
    const { childValue } = state;

    didUpdate.resolve(childValue);
  })

  test.on(effect);

  expect(effect).toBeCalledTimes(1);

  const pending = didUpdate.pending();

  promise.resolve("hello");

  await expect(pending).resolves.toBe("hello world!");
  expect(effect).toBeCalledTimes(2);
})

it("will return undefined on suspense", async () => {
  class Test extends Model {
    asyncValue = get(() => promise.pending());

    value = get(() => this.getValue);

    getValue(){
      const { asyncValue } = this;
      return `Hello ${asyncValue}`;
    }
  }

  const test = Test.new();
  const promise = mockAsync<string>();
  const didEvaluate = mockAsync<string>();

  const effect = jest.fn((state: Test) => {
    didEvaluate.resolve(state.value);
  });

  test.on(effect);

  expect(effect).toBeCalled();
  expect(effect).not.toHaveReturned();

  promise.resolve("World");

  await didEvaluate.pending();

  expect(test.value).toBe("Hello World")
})

it("will squash repeating suspense", async () => {
  const promise = mockAsync();
  let shouldSuspend = true;

  class Test extends Model {
    message = get(this.getSum);

    getSum(){
      didTryToEvaluate()

      if(shouldSuspend)
        throw promise.pending();

      return `OK I'm unblocked.`;
    }
  }

  const test = Test.new();
  const didEvaluate = mockAsync<string>();
  
  const didTryToEvaluate = jest.fn();
  const effect = jest.fn((state: Test) => {
    didEvaluate.resolve(state.message);
  });

  test.on(effect);

  expect(effect).toBeCalled();
  expect(effect).not.toHaveReturned();

  await promise.resolve();

  shouldSuspend = false;
  await promise.resolve();
  await didEvaluate.pending();

  expect(test.message).toBe("OK I'm unblocked.");
  expect(didTryToEvaluate).toBeCalledTimes(3);
  expect(effect).toBeCalledTimes(2);
  expect(effect).toHaveReturnedTimes(1);
})

it("will squash multiple dependancies", async () => {
  const promise = mockAsync<number>();
  const promise2 = mockAsync<number>();

  class Test extends Model {
    a = get(promise.pending());
    b = get(promise2.pending());

    sum = get(this.getSum);

    getSum(){
      const { a, b } = this;

      return `Answer is ${a + b}.`;
    }
  }

  const test = Test.new();
  const didEvaluate = mockAsync<string>();

  const effect = jest.fn((state: Test) => {
    didEvaluate.resolve(state.sum);
  });

  test.on(effect);

  expect(effect).toBeCalled();
  expect(effect).not.toHaveReturned();

  await promise.resolve(10);
  await promise2.resolve(20);

  await didEvaluate.pending();

  expect(test.sum).toBe("Answer is 30.")
})