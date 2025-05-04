import { Model } from '.';
import { Fragment, jsxDEV } from './jsx-dev-runtime';

it("exports jsxDEV", () => {
  expect(jsxDEV).toBeDefined();
});

it("will convert Model to element", () => {
  const element = jsxDEV(Model, { children: "Hello" }, "key", false);

  expect(element).toMatchObject({
    type: expect.any(Function),
    props: {
      children: "Hello"
    }
  });
})

it("exports Fragment", () => {
  expect(Fragment).toBeDefined();
});