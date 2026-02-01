import { act, render } from '@testing-library/preact';

import { State, Provider, Consumer } from '.';

describe('Provider', () => {
  it('will provide instance to children', () => {
    class Test extends State {
      value = 'foo';
    }

    const didRender = jest.fn();
    const test = Test.new();

    const Element = () => {
      const instance = Test.get();
      didRender(instance.value);
      return null;
    };

    render(
      <Provider for={test}>
        <Element />
      </Provider>
    );

    expect(didRender).toHaveBeenCalledWith('foo');
  });

  it('will provide class to children', () => {
    class Test extends State {
      value = 'foo';
    }

    const didRender = jest.fn();

    const Element = () => {
      const instance = Test.get();
      didRender(instance.value);
      return null;
    };

    render(
      <Provider for={Test}>
        <Element />
      </Provider>
    );

    expect(didRender).toHaveBeenCalledWith('foo');
  });

  it('will run forEach callback', () => {
    class Test extends State {
      value = 'foo';
    }

    const forEach = jest.fn();

    render(
      <Provider for={Test} forEach={forEach}>
        <div />
      </Provider>
    );

    expect(forEach).toHaveBeenCalledWith(expect.any(Test));
  });

  it('will handle forEach without cleanup', () => {
    class Test extends State {
      value = 'foo';
    }

    const forEach = jest.fn(() => undefined);

    render(
      <Provider for={Test} forEach={forEach}>
        <div />
      </Provider>
    );

    expect(forEach).toHaveBeenCalledWith(expect.any(Test));
  });

  it('will cleanup on unmount', () => {
    class Test extends State {
      value = 'foo';
    }

    const cleanup = jest.fn();

    const rendered = render(
      <Provider for={Test} forEach={() => cleanup}>
        <div />
      </Provider>
    );

    expect(cleanup).not.toHaveBeenCalled();

    rendered.unmount();

    expect(cleanup).toHaveBeenCalled();
  });

  it('will nest contexts', () => {
    class Parent extends State {
      value = 'parent';
    }

    class Child extends State {
      value = 'child';
    }

    const didRender = jest.fn();

    const Element = () => {
      const parent = Parent.get();
      const child = Child.get();
      didRender(parent.value, child.value);
      return null;
    };

    render(
      <Provider for={Parent}>
        <Provider for={Child}>
          <Element />
        </Provider>
      </Provider>
    );

    expect(didRender).toHaveBeenCalledWith('parent', 'child');
  });
});

describe('Consumer', () => {
  it('will fetch instance from context', () => {
    class Test extends State {
      value = 'foo';
    }

    const test = Test.new();
    const didRender = jest.fn();

    render(
      <Provider for={test}>
        <Consumer for={Test}>
          {(instance) => {
            didRender(instance.value);
            return null;
          }}
        </Consumer>
      </Provider>
    );

    expect(didRender).toHaveBeenCalledWith('foo');
  });

  it('will update on value changes', async () => {
    class Test extends State {
      value = 'foo';
    }

    const test = Test.new();
    const didRender = jest.fn();

    render(
      <Provider for={test}>
        <Consumer for={Test}>
          {(instance) => {
            didRender(instance.value);
            return <div>{instance.value}</div>;
          }}
        </Consumer>
      </Provider>
    );

    expect(didRender).toHaveBeenCalledWith('foo');

    await act(async () => {
      test.value = 'bar';
      await test.set();
    });

    expect(didRender).toHaveBeenCalledWith('bar');
  });

  it('will throw if not found', () => {
    class Test extends State {
      value = 'foo';
    }

    const didThrow = jest.fn();

    try {
      render(
        <Consumer for={Test}>
          {(instance) => {
            return <div>{instance.value}</div>;
          }}
        </Consumer>
      );
    } catch (error: any) {
      didThrow(error.message);
    }

    expect(didThrow).toHaveBeenCalledWith('Could not find Test in context.');
  });
});
