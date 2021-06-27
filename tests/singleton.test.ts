import { renderHook } from "@testing-library/react-hooks";
import { Oops } from "../src/singleton";
import { Singleton } from "./adapter";

class Global extends Singleton {
  value = 1;
}

it("will access values from create global", () => {
  const hook = renderHook(() => Global.use());

  expect(hook.result.current.value).toBe(1);
})

it("will find existing instance", () => {
  const instance = Global.create();
  const found = Global.find();

  expect(found).toStrictEqual(instance);
  
  instance.destroy();
})

it("will complain if not initialized", () => {
  Global.create();
  expect(Global.current).toBeDefined();

  Global.reset();
  expect(Global.current).toBeUndefined();
})

it("will destroy active instance on reset", () => {
  const hook = renderHook(() => Global.tap());
  const expected = Oops.GlobalDoesNotExist(Global.name);
  
  expect(() => hook.result.current).toThrowError(expected);
})

it.skip("will access values from found global", () => {
  const instance = Global.use();
  const hook = renderHook(() => Global.get("value"));

  expect(() => hook.result.current).toReturnWith(1);
  instance.destroy();
})

it("will complain already exists", () => {
  const expected = Oops.GlobalExists(Global.name);
  const instance = Global.create();
  
  expect(() => Global.create()).toThrowError(expected);

  instance.destroy();
})