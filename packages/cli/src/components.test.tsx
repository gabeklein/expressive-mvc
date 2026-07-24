import { describe, expect, it } from 'bun:test';
import { Component } from '@expressive/mvc';

import { flushMicrotasks } from '../test.setup';
import { Block } from './block';
import { Panel, Progress, Spinner, Text } from './components';
import { render as mount } from './render';

const render: typeof mount = (node, options) =>
  mount(node, { output: { write: () => true }, ...options });

describe('Block', () => {
  it('will pass text through by default', () => {
    const app = render(<Block>plain</Block>);
    expect(app.frame).toBe('plain');
    app.unmount();
  });

  it('will format subtree output', () => {
    class Loud extends Block {
      format(text: string) {
        return text.toUpperCase();
      }
    }

    const app = render(<Loud>so loud</Loud>);
    expect(app.frame).toBe('SO LOUD');
    app.unmount();
  });

  it('will format nested component output', async () => {
    class Inner extends Component {
      word = 'quiet';

      render() {
        return this.word;
      }
    }

    class Loud extends Block {
      format(text: string) {
        return text.toUpperCase();
      }
    }

    let inner!: Inner;
    const app = render(
      <Loud>
        <Inner is={(x) => (inner = x)} />
      </Loud>
    );

    expect(app.frame).toBe('QUIET');

    inner.word = 'louder';
    await expect(inner).toHaveUpdated('word');
    await flushMicrotasks();

    expect(app.frame).toBe('LOUDER');
    app.unmount();
  });

  it('will repaint when format state changes directly', async () => {
    class Wrap extends Block {
      char = '*';

      format(text: string) {
        return this.char + text + this.char;
      }
    }

    let wrap!: Wrap;
    const app = render(<Wrap is={(x) => (wrap = x)}>mid</Wrap>);

    expect(app.frame).toBe('*mid*');

    wrap.char = '~';
    await expect(wrap).toHaveUpdated('char');
    await flushMicrotasks();

    expect(app.frame).toBe('~mid~');
    app.unmount();
  });
});

describe('Text', () => {
  it('will apply color', () => {
    const app = render(<Text color="red">stop</Text>);
    expect(app.frame).toBe('\x1b[31mstop\x1b[39m');
    app.unmount();
  });

  it('will apply modifiers', () => {
    const app = render(<Text bold>loud</Text>);
    expect(app.frame).toBe('\x1b[1mloud\x1b[22m');
    app.unmount();
  });

  it('will stack color and modifiers', () => {
    const app = render(<Text color="green" dim>ok</Text>);
    expect(app.frame).toBe('\x1b[32m\x1b[2mok\x1b[22m\x1b[39m');
    app.unmount();
  });

  it('will reopen around nested styles', () => {
    const app = render(
      <Text color="red">
        outer <Text color="blue">inner</Text> outer
      </Text>
    );

    expect(app.frame).toBe(
      '\x1b[31mouter \x1b[34minner\x1b[39m\x1b[31m outer\x1b[39m'
    );
    app.unmount();
  });

  it('will style each line but skip empty ones', () => {
    const app = render(<Text color="cyan">{'one\n\ntwo'}</Text>);
    expect(app.frame).toBe('\x1b[36mone\x1b[39m\n\n\x1b[36mtwo\x1b[39m');
    app.unmount();
  });

  it('will pass through unstyled', () => {
    const app = render(<Text>bare</Text>);
    expect(app.frame).toBe('bare');
    app.unmount();
  });
});

describe('Panel', () => {
  it('will draw a border around content', () => {
    const app = render(<Panel>hi</Panel>);
    expect(app.frame).toBe('╭──╮\n│hi│\n╰──╯');
    app.unmount();
  });

  it('will size to the longest line', () => {
    const app = render(<Panel>{'one\nlonger'}</Panel>);
    expect(app.frame).toBe('╭──────╮\n│one   │\n│longer│\n╰──────╯');
    app.unmount();
  });

  it('will apply padding', () => {
    const app = render(<Panel padding={1}>hi</Panel>);
    expect(app.frame).toBe('╭────╮\n│    │\n│ hi │\n│    │\n╰────╯');
    app.unmount();
  });

  it('will include a title', () => {
    const app = render(<Panel title="Info">hi</Panel>);
    expect(app.frame).toBe('╭ Info ╮\n│hi    │\n╰──────╯');
    app.unmount();
  });

  it('will support border styles', () => {
    const app = render(<Panel border="double">hi</Panel>);
    expect(app.frame).toBe('╔══╗\n║hi║\n╚══╝');
    app.unmount();
  });

  it('will measure styled content by visible width', () => {
    const app = render(
      <Panel>
        <Text color="red">hi</Text>
      </Panel>
    );
    expect(app.frame).toBe('╭──╮\n│\x1b[31mhi\x1b[39m│\n╰──╯');
    app.unmount();
  });

  it('will trim trailing newline from content', () => {
    const app = render(<Panel>{'hi\n'}</Panel>);
    expect(app.frame).toBe('╭──╮\n│hi│\n╰──╯');
    app.unmount();
  });

  it('will render empty content', () => {
    const app = render(<Panel />);
    expect(app.frame).toBe('╭╮\n╰╯');
    app.unmount();
  });
});

describe('Spinner', () => {
  it('will animate frames on an interval', async () => {
    let spinner!: Spinner;
    const app = render(
      <Spinner interval={10} is={(x) => (spinner = x)} />
    );

    expect(app.frame).toBe('⠋');

    await new Promise((r) => setTimeout(r, 35));

    expect(spinner.frame).toBeGreaterThan(0);
    expect(app.frame).toBe(spinner.frames[spinner.frame % spinner.frames.length]);

    app.unmount();

    const idle = spinner.frame;
    await new Promise((r) => setTimeout(r, 25));
    expect(spinner.frame).toBe(idle);
  });

  it('will accept custom frames', () => {
    class Dots extends Spinner {
      frames = ['.', '..', '...'];
    }

    const app = render(<Dots />);
    expect(app.frame).toBe('.');
    app.unmount();
  });
});

describe('Progress', () => {
  it('will render proportional fill', () => {
    const app = render(<Progress value={0.5} width={4} />);
    expect(app.frame).toBe('██░░');
    app.unmount();
  });

  it('will clamp out-of-range values', () => {
    const low = render(<Progress value={-1} width={4} />);
    expect(low.frame).toBe('░░░░');
    low.unmount();

    const high = render(<Progress value={2} width={4} />);
    expect(high.frame).toBe('████');
    high.unmount();
  });

  it('will use custom characters', () => {
    const app = render(<Progress value={1} width={3} filled="#" empty="-" />);
    expect(app.frame).toBe('###');
    app.unmount();
  });

  it('will update with value', async () => {
    let progress!: Progress;
    const app = render(
      <Progress value={0} width={2} is={(x) => (progress = x)} />
    );

    expect(app.frame).toBe('░░');

    progress.value = 1;
    await expect(progress).toHaveUpdated('value');
    await flushMicrotasks();

    expect(app.frame).toBe('██');
    app.unmount();
  });
});
