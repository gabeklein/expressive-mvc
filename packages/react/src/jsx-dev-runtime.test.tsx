import { Model } from '.';
import { Fragment, jsxDEV } from './jsx-dev-runtime';

it("exports jsxDEV", () => {
  expect(jsxDEV).toBeDefined();
});

it("exports Fragment", () => {
  expect(Fragment).toBeDefined();
});

it("will convert Model to element", () => {
  class Test extends Model {}

  const element = jsxDEV(Test, { children: "Hello" }, "key", false);

  expect(element).toMatchObject({
    type: expect.any(Function),
    props: {
      children: "Hello"
    }
  });
})