/** @jsx solid */
import { renderHook, render } from '@solidjs/testing-library';
import { describe, it, expect } from 'vitest';

import Model from '.';

class Test extends Model {
  value = "foo";
};

describe("hook", () => {
  it("will create instance given a class", () => {
    const hook = renderHook(() => Test.use());
  
    expect(hook.result).toBeInstanceOf(Test);
  })

  it("will not create abstract class", () => {
    const Test = () => {
      // @ts-expect-error
      expect(() => Model.use()).toThrowError();
      return null;
    }

    render(<Test />);
  })
  
  it("will subscribe to instance of controller", async () => {
    const hook = renderHook(() => Test.use());
  
    expect(hook.result.value()).toBe("foo");
  
    hook.result.is.value = "bar";
  
    expect(hook.result.value()).toBe("bar");
  })
})