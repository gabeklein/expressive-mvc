import { Model } from '..';
import { mockAsync, mockConsole } from '../../tests/adapter';
import { get, Oops as Compute } from './get';

const { warn } = mockConsole();

it("will compute when accessed", () => {
  const factory = jest.fn(() => "Hello World");

  class Test extends Model {
    value = get(factory);
  }

  const test = Test.create();

  expect(factory).not.toBeCalled();

  void test.value;

  expect(factory).toBeCalled();
})

it("will compute lazily", () => {
  const factory = jest.fn(async () => "Hello World");

  class Test extends Model {
    value = get(factory, false);
  }

  Test.create();

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

  const instance = Test.create();
})

it("will emit when factory resolves", async () => {
  class Test extends Model {
    value = get(async () => "foobar");
  }

  const test = Test.create();

  expect(() => test.value).toThrow(expect.any(Promise));

  await test.once("value");

  expect(test.value).toBe("foobar");
})

it("will not suspend where already resolved", async () => {
  class Test extends Model {
    greet = get(async () => "Hello");
    name = get(async () => "World");

    value = get(() => this.greet + " " + this.name);
  }

  const test = Test.create();

  await test.once("value");

  expect(() => test.value).not.toThrow();
})

it("will throw suspense-promise resembling an error", () => {
  const promise = mockAsync();

  class Test extends Model {
    value = get(promise.pending);
  }

  const instance = Test.create();
  const exprected = Compute.NotReady(instance, "value");

  expect(() => instance.value).toThrowError(exprected);
  promise.resolve();
})

it("will warn and rethrow error from factory", () => {
  class Test extends Model {
    memoized = get(this.failToGetSomething, true);

    failToGetSomething(){
      throw new Error("Foobar") 
    }
  }

  const failed = Compute.FactoryFailed(Test.name, "memoized");

  expect(() => Test.create()).toThrowError("Foobar");
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

  const test = Test.create();

  test.effect($ => void $.value);

  greet.resolve("Hello");
  await test.update();

  name.resolve("World");
  await test.update();

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

  const test = Test.create();

  test.effect($ => void $.value);

  greet.resolve("Hello");
  await test.update();

  name.resolve("World");
  await test.update();

  expect(didEvaluate).toBeCalledTimes(3);
  expect(test.value).toBe("Hello World");
})

it("will throw if missing factory", () => {
  class Test extends Model {
    // @ts-ignore
    value = get(this);
  }

  const test = Test.create();

  expect(() => test.value).toThrowError(
    "Factory argument cannot be undefined"
  );
})