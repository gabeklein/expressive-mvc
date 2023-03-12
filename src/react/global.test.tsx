import { renderHook } from '@testing-library/react-hooks';
import React from 'react';

import { Global } from '..';
import { render } from '../helper/testing';
import { get } from '../instruction/get';
import { Oops as Get } from './get';
import { MVC } from './mvc';
import { Provider } from './provider';
import { Oops } from './useContext';

describe("init", () => {
  class Test extends Global {
    value = 1;
  }

  afterEach(() => {
    Test.get(instance => {
      instance.gc(true);
    });
  });

  it("will access values from created global", () => {
    const hook = renderHook(() => Test.use());

    expect(hook.result.current.value).toBe(1);
  })

  it("will get an existing instance", () => {
    const instance = Test.new();

    expect(Test.get()).toBe(instance);
  })

  it("will throw if cannot get instance", () => {
    const expected = Oops.DoesNotExist(Test.name);

    expect(() => Test.get()).toThrowError(expected);
  })

  it("will return undefined if not initialized", () => {
    Test.new();
    expect(Test.get()).toBeDefined();

    Test.get().gc(true);
    expect(Test.get(false)).toBeUndefined();
  })

  it("will throw if Global does not exist", () => {
    const hook = renderHook(() => Test.tap());
    const expected = Oops.DoesNotExist(Test.name);

    expect(() => hook.result.current).toThrowError(expected);
  })

  it("will complain already exists", () => {
    class Test extends Global {
      static keepAlive = false;
    }

    Test.new();
    const expected = Oops.AlreadyExists(Test.name);

    expect(() => Test.new()).toThrowError(expected);
  })
})

describe("provider", () => {
  it("will create but not destroy instance", () => {
    class Test extends Global {}

    expect(Test.get(false)).toBeUndefined();

    const element = render(<Provider for={Test} />);
    const test = Test.get();

    expect(test).toBeInstanceOf(Test);

    element.unmount();

    expect(Test.get()).toBe(test);

    render(<Provider for={Test} />).unmount();

    test.gc(true);
  })
})

describe("get instruction", () => {
  it("will attach to model", () => {
    class Foo extends MVC {
      global = get(TestGlobal);
    }

    class TestGlobal extends Global {
      value = "bar";
    }

    TestGlobal.new();

    const Test = () => {
      const { global } = Foo.use();
      expect(global.value).toBe("bar");
      return null;
    }

    render(<Test />);
  })

  it("will attach to another singleton", () => {
    class Peer extends Global {}
    class Test extends Global {
      peer = get(Peer);
    }

    const peer = Peer.new();
    const global = Test.new();    

    expect(global.peer).toBe(peer);
  })

  it("will throw if tries to attach Model", () => {
    class Normal extends MVC {}
    class TestGlobal extends Global {
      notPossible = get(Normal);
    }

    const attempt = () => TestGlobal.new();
    const issue = Get.NotAllowed(TestGlobal.name, Normal.name);

    expect(attempt).toThrowError(issue);
  })
})

describe("mvc", () => {
  class Test extends Global {
    value = 1;
  }

  afterEach(() => {
    Test.get(instance => {
      instance.gc(true);
    });
  });

  it("will get instance outside component", () => {
    const instance = Test.new();
    const got = Test.get();

    expect(got).toBe(instance);
    expect(got.value).toBe(1);
  })

  it("will call return-effect on unmount", () => {
    const effect = jest.fn(() => effect2);
    const effect2 = jest.fn();

    Test.new();

    const element = renderHook(() => Test.get(effect));

    expect(effect).toBeCalled();
    expect(effect2).not.toBeCalled();

    element.unmount();

    expect(effect2).toBeCalled();
  })

  it("will call return-effect on destroy", () => {
    const effect = jest.fn(() => effect2);
    const effect2 = jest.fn();
    const test = Test.new();

    Test.get(effect)

    expect(effect).toBeCalled();
    expect(effect2).not.toBeCalled();

    test.gc(true);

    expect(effect2).toBeCalled();
  })
})