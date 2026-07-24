import { describe, expect, it } from 'bun:test';
import { Component, Context, State, get, set } from '@expressive/mvc';

import { flushMicrotasks, mockPromise } from '../test.setup';
import { jsx } from './jsx-runtime';
import { render as mount } from './render';
import type { Output } from './terminal';

const render: typeof mount = (node, options) =>
  mount(node, { output: { write: () => true }, ...options });

function mockOutput(isTTY = true) {
  const writes: string[] = [];
  const output: Output = {
    isTTY,
    write(text: string) {
      writes.push(text);
      return true;
    }
  };
  return { writes, output };
}

describe('content', () => {
  it('will render text', () => {
    const app = render('Hello World');
    expect(app.frame).toBe('Hello World');
    app.unmount();
  });

  it('will render numbers and arrays', () => {
    const app = render(['Count: ', 42]);
    expect(app.frame).toBe('Count: 42');
    app.unmount();
  });

  it('will render fragments', () => {
    const app = render(
      <>
        {'Hello'} {'World'}
      </>
    );
    expect(app.frame).toBe('Hello World');
    app.unmount();
  });

  it('will skip null and boolean children', () => {
    const app = render(['a', null, true, false, undefined, 'b']);
    expect(app.frame).toBe('ab');
    app.unmount();
  });

  it('will render function components', () => {
    const Banner = (props: { label?: string }) => `[${props.label}]`;
    const app = render(<Banner label="ok" />);
    expect(app.frame).toBe('[ok]');
    app.unmount();
  });

  it('will throw on intrinsic tags', () => {
    expect(() => render(jsx('div', {}))).toThrow(
      'Unsupported element type: <div>'
    );
  });
});

describe('component', () => {
  class Greeting extends Component {
    name = 'World';

    render() {
      return `Hello ${this.name}`;
    }
  }

  it('will render output', () => {
    const app = render(<Greeting />);
    expect(app.frame).toBe('Hello World');
    app.unmount();
  });

  it('will apply props to state', () => {
    const app = render(<Greeting name="Terminal" />);
    expect(app.frame).toBe('Hello Terminal');
    app.unmount();
  });

  it('will update output when state changes', async () => {
    let greeting!: Greeting;
    const app = render(<Greeting is={(x) => (greeting = x)} />);

    expect(app.frame).toBe('Hello World');

    greeting.name = 'Again';
    await expect(greeting).toHaveUpdated('name');
    await flushMicrotasks();

    expect(app.frame).toBe('Hello Again');
    app.unmount();
  });

  it('will pass children through by default', () => {
    class Frame extends Component { }

    const app = render(<Frame>contents</Frame>);
    expect(app.frame).toBe('contents');
    app.unmount();
  });

  it('will destroy instance on unmount', () => {
    let greeting!: Greeting;
    const app = render(<Greeting is={(x) => (greeting = x)} />);

    expect(greeting.get(null)).toBe(false);
    app.unmount();
    expect(greeting.get(null)).toBe(true);
  });

  it('will provide context to children', () => {
    class Provider extends Component {
      value = 'from parent';
    }

    class Consumer extends Component {
      parent = get(Provider);

      render() {
        return this.parent.value;
      }
    }

    const app = render(
      <Provider>
        <Consumer />
      </Provider>
    );

    expect(app.frame).toBe('from parent');
    app.unmount();
  });
});

describe('update', () => {
  class Item extends Component {
    label = '';

    render() {
      return `[${this.label}]`;
    }
  }

  it('will update child props in place', async () => {
    class Parent extends Component {
      value = 1;

      render() {
        return <Item label={`v${this.value}`} />;
      }
    }

    let parent!: Parent;
    const app = render(<Parent is={(x) => (parent = x)} />);

    expect(app.frame).toBe('[v1]');

    parent.value = 2;
    await expect(parent).toHaveUpdated('value');
    await flushMicrotasks();

    expect(app.frame).toBe('[v2]');
    app.unmount();
  });

  it('will reuse keyed children', async () => {
    let list!: TrackedList;
    const instances = new Set<Tracked>();

    class Tracked extends Component {
      label = '';

      constructor(props: object) {
        super(props);
        instances.add(this);
      }

      render() {
        return `[${this.label}]`;
      }
    }

    class TrackedList extends Component {
      items = ['a', 'b'];

      render() {
        return this.items.map((label) => <Tracked key={label} label={label} />);
      }
    }

    const app = render(<TrackedList is={(x) => (list = x)} />);

    expect(app.frame).toBe('[a][b]');
    expect(instances.size).toBe(2);

    list.items = ['b', 'a'];
    await expect(list).toHaveUpdated('items');
    await flushMicrotasks();

    expect(app.frame).toBe('[b][a]');
    expect(instances.size).toBe(2);

    app.unmount();
  });

  it('will unmount removed children', async () => {
    let list!: SpyList;
    let second!: Spy;

    class Spy extends Component {
      label = '';

      new() {
        if (this.label == 'b') second = this;
      }

      render() {
        return `[${this.label}]`;
      }
    }

    class SpyList extends Component {
      items = ['a', 'b'];

      render() {
        return this.items.map((label) => <Spy key={label} label={label} />);
      }
    }

    const app = render(<SpyList is={(x) => (list = x)} />);

    expect(app.frame).toBe('[a][b]');

    list.items = ['a'];
    await expect(list).toHaveUpdated('items');
    await flushMicrotasks();

    expect(app.frame).toBe('[a]');
    expect(second.get(null)).toBe(true);

    app.unmount();
  });

  it('will replace incompatible slots', async () => {
    class Toggle extends Component {
      flag = true;

      render() {
        return this.flag ? <Item label="on" /> : 'off';
      }
    }

    let toggle!: Toggle;
    const app = render(<Toggle is={(x) => (toggle = x)} />);

    expect(app.frame).toBe('[on]');

    toggle.flag = false;
    await expect(toggle).toHaveUpdated('flag');
    await flushMicrotasks();

    expect(app.frame).toBe('off');

    toggle.flag = true;
    await expect(toggle).toHaveUpdated('flag');
    await flushMicrotasks();

    expect(app.frame).toBe('[on]');
    app.unmount();
  });

  it('will update text in place', async () => {
    class Ticker extends Component {
      count = 0;

      render() {
        return `tick ${this.count}`;
      }
    }

    let ticker!: Ticker;
    const app = render(<Ticker is={(x) => (ticker = x)} />);

    ticker.count = 1;
    await expect(ticker).toHaveUpdated('count');
    await flushMicrotasks();

    expect(app.frame).toBe('tick 1');
    app.unmount();
  });

  it('will re-render function component children', async () => {
    const Label = (props: { text?: string }) => `<${props.text}>`;

    class Host extends Component {
      text = 'one';

      render() {
        return <Label text={this.text} />;
      }
    }

    let host!: Host;
    const app = render(<Host is={(x) => (host = x)} />);

    expect(app.frame).toBe('<one>');

    host.text = 'two';
    await expect(host).toHaveUpdated('text');
    await flushMicrotasks();

    expect(app.frame).toBe('<two>');
    app.unmount();
  });

  it('will update nested fragment content', async () => {
    class Wrap extends Component {
      inner = 'x';

      render() {
        return (
          <>
            (<>{this.inner}</>)
          </>
        );
      }
    }

    let wrap!: Wrap;
    const app = render(<Wrap is={(x) => (wrap = x)} />);

    expect(app.frame).toBe('(x)');

    wrap.inner = 'y';
    await expect(wrap).toHaveUpdated('inner');
    await flushMicrotasks();

    expect(app.frame).toBe('(y)');
    app.unmount();
  });
});

describe('suspense', () => {
  it('will show fallback until value is ready', async () => {
    class Loader extends Component {
      data = set<string>();
      fallback = 'loading...' as Component.Node;

      render() {
        return `got ${this.data}`;
      }
    }

    let loader!: Loader;
    const app = render(<Loader is={(x) => (loader = x)} />);

    expect(app.frame).toBe('loading...');

    loader.data = 'value';
    await expect(loader).toHaveUpdated('data');
    await flushMicrotasks();

    expect(app.frame).toBe('got value');
    app.unmount();
  });

  it('will render nothing by default while suspended', () => {
    class Loader extends Component {
      data = set<string>();

      render() {
        return this.data;
      }
    }

    const app = render(['before|', <Loader />, '|after']);
    expect(app.frame).toBe('before||after');
    app.unmount();
  });
});

describe('catch', () => {
  it('will show fallback and recover', async () => {
    const recovery = mockPromise();

    class Boundary extends Component {
      fallback = 'recovering' as Component.Node;
      broken = true;

      render() {
        if (this.broken) throw new Error('render failed');
        return 'recovered';
      }

      catch(error: Error) {
        expect(error.message).toBe('render failed');
        this.is.broken = false;
        return recovery;
      }
    }

    const app = render(<Boundary />);

    expect(app.frame).toBe('recovering');

    recovery.resolve();
    await flushMicrotasks();

    expect(app.frame).toBe('recovered');
    app.unmount();
  });

  it('will catch errors from children', () => {
    class Broken extends Component {
      render(): Component.Node {
        throw new Error('child failed');
      }
    }

    class Boundary extends Component {
      fallback = 'contained' as Component.Node;

      catch(error: Error) {
        expect(error.message).toBe('child failed');
      }

      render() {
        return <Broken />;
      }
    }

    const app = render(<Boundary />);
    expect(app.frame).toBe('contained');
    app.unmount();
  });

  it('will rethrow without a boundary', () => {
    class Broken extends Component {
      render(): Component.Node {
        throw new Error('nothing caught this');
      }
    }

    expect(() => render(<Broken />)).toThrow('nothing caught this');
  });

  it('will catch async update errors', async () => {
    const recovery = mockPromise();

    class Fragile extends Component {
      explode = false;

      render() {
        if (this.explode) throw new Error('late failure');
        return 'intact';
      }
    }

    class Boundary extends Component {
      fallback = 'contained' as Component.Node;

      catch() {
        return recovery;
      }

      render() {
        return <Fragile is={(x) => (fragile = x)} />;
      }
    }

    let fragile!: Fragile;
    const app = render(<Boundary />);

    expect(app.frame).toBe('intact');

    fragile.explode = true;
    await expect(fragile).toHaveUpdated('explode');
    await flushMicrotasks();

    expect(app.frame).toBe('contained');

    recovery.resolve();
    await flushMicrotasks();

    expect(app.frame).toBe('intact');
    app.unmount();
  });
});

describe('output', () => {
  it('will write frames to interactive output', async () => {
    class Counter extends Component {
      count = 0;

      render() {
        return `count: ${this.count}`;
      }
    }

    let counter!: Counter;
    const { writes, output } = mockOutput();
    const app = render(<Counter is={(x) => (counter = x)} />, { output });

    expect(writes).toEqual(['count: 0\n']);

    counter.count = 1;
    await expect(counter).toHaveUpdated('count');
    await flushMicrotasks();

    expect(writes[1]).toBe('\x1b[2K\x1b[1A\x1b[2K\rcount: 1\n');

    app.unmount();
  });

  it('will only write final frame when not interactive', async () => {
    class Counter extends Component {
      count = 0;

      render() {
        return `count: ${this.count}`;
      }
    }

    let counter!: Counter;
    const { writes, output } = mockOutput(false);
    const app = render(<Counter is={(x) => (counter = x)} />, { output });

    counter.count = 5;
    await expect(counter).toHaveUpdated('count');
    await flushMicrotasks();

    expect(writes).toEqual([]);

    app.unmount();
    expect(writes).toEqual(['count: 5\n']);
  });

  it('will not repaint after unmount', async () => {
    class Counter extends Component {
      count = 0;

      render() {
        return `count: ${this.count}`;
      }
    }

    let counter!: Counter;
    const { writes, output } = mockOutput();
    const app = render(<Counter is={(x) => (counter = x)} />, { output });

    counter.count = 1;
    app.unmount();
    app.unmount();
    await flushMicrotasks();

    expect(writes).toEqual(['count: 0\n']);
  });

  it('will render within a provided context', () => {
    class Config extends State {
      mode = 'test';
    }

    class Show extends Component {
      config = get(Config);

      render() {
        return this.config.mode;
      }
    }

    const context = new Context({ Config });
    const app = render(<Show />, { context });

    expect(app.frame).toBe('test');
    app.unmount();
    context.pop();
  });
});
