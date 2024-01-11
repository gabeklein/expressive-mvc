import { lazy } from "./lazy";
import { Model } from "./model";

it("will resolve instance of model", async () => {
  class Test extends Model {
    foo = "bar";
  }

  const Lazy = lazy(async () => Test);

  const lazyTest = await new Lazy();

  expect(lazyTest).toBeInstanceOf(Test);
});