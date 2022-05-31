import React from 'react';
import { act } from 'react-test-renderer';

import { render } from '../../tests/adapter';
import { Model } from '../model';
import { Consumer } from './consumer';
import { MVC } from './mvc';
import { Oops as Provide, Provider } from './provider';

class Foo extends MVC {
  value?: string = undefined;
}
class Bar extends MVC {}

it("will create instance of given model", () => {
  render(
    <Provider of={Foo}>
      <Consumer of={Foo} get={i => expect(i).toBeInstanceOf(Foo)} />
    </Provider>
  );
})

it("will destroy instance of given model", async () => {
  const didUnmount = jest.fn();

  const result = render(
    <Provider of={Foo}>
      <Consumer of={Foo} has={i => {
        i.effect(() => didUnmount, []);
      }} />
    </Provider>
  );

  result.unmount();

  expect(didUnmount).toHaveBeenCalled()
});

it("will accept render function when model given", () => {
  render(
    <Provider of={Foo}>
      {(instance) => {
        return <Consumer of={Foo} get={i => {
          // instance injected should be a subscribe-clone.
          expect(instance).not.toBe(i);
          // get actual instance via circular-get property.
          expect(instance.is).toBe(i);
        }} />
      }}
    </Provider>
  );
})

it("will pass undefined to render function if multiple", () => {
  render(
    <Provider of={{ Foo, Bar }}>
      {(instance) => {
        expect(instance).toBeUndefined();
        return null;
      }}
    </Provider>
  );
})

it("will refresh render function as a subscriber", async () => {
  const didRender = jest.fn();
  const test = Foo.create();

  render(
    <Provider of={test}>
      {({ value }) => {
        didRender(value);
        return null;
      }}
    </Provider>
  );

  expect(didRender).toBeCalledWith(undefined);

  await act(async () => {
    test.value = "foobar";
    await test.update(true);
  })
  
  expect(didRender).toBeCalledWith("foobar");
})

it("will assign props to instance", () => {
  render(
    <Provider of={Foo} value="foobar">
      <Consumer of={Foo} has={i => expect(i.value).toBe("foobar")} />
    </Provider>
  );
})

it("will assign props to muliple controllers", () => {
  class Bar extends Model {
    value = "";
  }

  render(
    <Provider of={{ Foo, Bar }} value="foobar">
      <Consumer of={Foo} has={i => expect(i.value).toBe("foobar")} />
      <Consumer of={Bar} has={i => expect(i.value).toBe("foobar")} />
    </Provider>
  );
});

it("will not assign foreign props to controller", () => {
  render(
    // @ts-ignore - type-checking warns against this
    <Provider of={Foo} nonValue="foobar">
      <Consumer of={Foo} has={i => {
        // @ts-ignore
        expect(i.nonValue).toBeUndefined();
      }} />
    </Provider>
  );
})

it("will create all models in given object", () => {
  render(
    <Provider of={{ Foo, Bar }}>
      <Consumer of={Foo} get={i => expect(i).toBeInstanceOf(Foo)} />
      <Consumer of={Bar} get={i => expect(i).toBeInstanceOf(Bar)} />
    </Provider>
  )
})

it("will destroy created model on unmount", () => {
  const willDestroy = jest.fn();

  class Test extends Model {}

  const rendered = render(
    <Provider of={{ Test }}>
      <Consumer of={Test} has={i => {
        expect(i).toBeInstanceOf(Test)
        i.effect(() => willDestroy, []);
      }} />
    </Provider>
  );

  rendered.unmount();
  expect(willDestroy).toBeCalled();
})

it("will destroy multiple created on unmount", () => {
  const willDestroy = jest.fn();

  class Foo extends Model {}
  class Bar extends Model {}

  const rendered = render(
    <Provider of={{ Foo, Bar }}>
      <Consumer of={Foo} has={i => {
        i.effect(() => willDestroy, []);
      }} />
      <Consumer of={Bar} has={i => {
        i.effect(() => willDestroy, []);
      }} />
    </Provider>
  );

  rendered.unmount();
  expect(willDestroy).toBeCalledTimes(2);
})

it("will not destroy given instance on unmount", () => {
  const didUnmount = jest.fn();

  class Test extends Model {}

  const instance = Test.create();

  const rendered = render(
    <Provider of={{ instance }}>
      <Consumer of={Test} has={i => {
        i.effect(() => didUnmount, []);
      }} />
    </Provider>
  );

  rendered.unmount();
  expect(didUnmount).not.toBeCalled();
})


it("will create all models in given array", () => {
  render(
    <Provider of={[ Foo, Bar ]}>
      <Consumer of={Foo} get={i => expect(i).toBeInstanceOf(Foo)} />
      <Consumer of={Bar} get={i => expect(i).toBeInstanceOf(Bar)} />
    </Provider>
  )
})

it("will provide a mix of state and models", () => {
  const foo = Foo.create();

  render(
    <Provider of={{ foo, Bar }}>
      <Consumer of={Foo} get={i => expect(i).toBe(foo)} />
      <Consumer of={Bar} get={i => expect(i).toBeInstanceOf(Bar)} />
    </Provider>
  )
})

it("will throw if no `of` or `for` prop given", () => {
  // @ts-ignore
  const test = () => render(<Provider />);

  expect(test).toThrow(Provide.NoProviderType());
})