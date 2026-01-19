import { Context } from '../context';
import { State } from '../state';
import { get } from './get';

describe('bidirectional mode', () => {
  it('will find state from parent context', () => {
    class Ambient extends State {}
    class Child extends State {
      ambient = get(Ambient, (state, child) => {
        expect(child).toBe(false);
      });
    }

    const ambient = Ambient.new();
    const child = Child.new();

    new Context({ ambient }).push({ child });

    expect(child.ambient).toEqual([ambient]);
  });

  it('will collect states searching for it from below', () => {
    class Parent extends State {
      requesters = get(Child, (state, child) => {
        expect(child).toBe(true);
      });
    }
    class Child extends State {
      parent = get(Parent);
    }

    const parent = Parent.new();
    const child = Child.new();

    new Context({ parent }).push({ child });

    expect(parent.requesters).toEqual([child]);
    expect(child.parent).toBe(parent);
  });

  it('will do both parent search and child collection', () => {
    class Ambient extends State {}
    class Middle extends State {
      ambient = get(Ambient, (state, child) => {
        callbacks.push(child ? 'child' : 'parent');
      });
    }
    class Child extends State {
      middle = get(Middle);
    }

    const callbacks: string[] = [];
    const ambient = Ambient.new();
    const middle = Middle.new();
    const child = Child.new();

    new Context({ ambient }).push({ middle }).push({ child });

    expect(middle.ambient).toEqual([ambient]);
    expect(callbacks).toEqual(['parent', 'child']);
  });

  it('will not be enumerable', () => {
    class Ambient extends State {}
    class Test extends State {
      ambient = get(Ambient, () => {});
      foo = 'bar';
    }
    const test = Test.new();
    const ambient = Ambient.new();

    new Context({ ambient, test });

    expect(test.ambient).toEqual([ambient]);
    expect(Object.keys(test)).toMatchObject(['foo']);
  });

  it('will allow callback to prevent registration', () => {
    class Ambient extends State {}
    class Test extends State {
      ambient = get(Ambient, (state, child) => {
        if (child) return false;  // prevent child registration
      });
    }

    const ambient = Ambient.new();
    const test = Test.new();
    const test2 = Test.new();

    // test searches up and finds ambient
    new Context({ ambient }).push({ test });
    // test2 sets up bidirectional, then ambient is added below (searching up from test2's context)
    new Context({ test2 }).push({ Ambient });

    expect(test.ambient).toEqual([ambient]);
    expect(test2.ambient).toEqual([]);  // prevented by callback
  });

  it('will call cleanup function on removal', () => {
    class Child extends State {
      parent = get(Parent);
    }
    class Parent extends State {
      requesters = get(Child, () => cleanup);
    }

    const cleanup = jest.fn();
    const parent = Parent.new();
    const child = Child.new();

    const context = new Context({ parent }).push({ child });

    expect(parent.requesters).toEqual([child]);

    context.pop();

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(parent.requesters).toEqual([]);
  });

  it('will track multiple instances', () => {
    class Child extends State {
      parent = get(Parent);
    }
    class Parent extends State {
      requesters = get(Child, () => {});
    }

    const parent = Parent.new();
    const child1 = Child.new();
    const child2 = Child.new();

    const context = new Context({ parent });
    context.push({ child: child1 });
    context.push({ child: child2 });

    expect(parent.requesters).toEqual([child1, child2]);
  });
});

describe('recipient mode', () => {
  it('will register parent states searching for it', () => {
    class Child extends State {
      parents = get((state, child) => {
        expect(state).toBeInstanceOf(Parent);
        expect(child).toBe(false);  // parent searching down
      });
    }
    class Parent extends State {
      children = get(Child, () => {});
    }

    const parent = Parent.new();
    const child = Child.new();

    new Context({ parent }).push({ child });

    expect(child.parents).toEqual([parent]);
  });

  it('will not be enumerable', () => {
    class Child extends State {
      parents = get(() => {});
      foo = 'bar';
    }
    class Parent extends State {
      children = get(Child, () => {});
    }

    const parent = Parent.new();
    const child = Child.new();

    new Context({ parent }).push({ child });

    expect(Object.keys(child)).toMatchObject(['foo']);
    expect(child.parents).toEqual([parent]);
  });

  it('will allow callback to prevent registration', () => {
    class Child extends State {
      parents = get((state) => {
        if (state instanceof Parent) return false;
      });
    }
    class Parent extends State {
      children = get(Child, () => {});
    }

    const parent = Parent.new();
    const child = Child.new();

    new Context({ parent }).push({ child });

    expect(child.parents).toEqual([]);
  });

  it('will call cleanup function on removal', () => {
    class Child extends State {
      parents = get(() => cleanup);
    }
    class Parent extends State {
      children = get(Child, () => {});
    }

    const cleanup = jest.fn();
    const parent = Parent.new();
    const child = Child.new();

    const context = new Context({ parent }).push({ child });

    expect(child.parents).toEqual([parent]);

    context.pop();

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(child.parents).toEqual([]);
  });

  it('will complain if used more than once', () => {
    class Child extends State {
      parents1 = get(() => {});
      parents2 = get(() => {});
    }

    expect(() => Child.new()).toThrowError(
      `'get' callback can only be used once per state.`
    );
  });

  it('will register multiple parents', () => {
    class Child extends State {
      parents = get();
    }
    class Parent extends State {
      children = get(Child, () => {});
    }

    const child = Child.new();
    const parent1 = Parent.new();
    const parent2 = Parent.new();

    new Context({ parent: parent1 }).push({ child });
    new Context({ parent: parent2 }).push({ child });

    expect(child.parents).toEqual([parent1, parent2]);
  });
});
