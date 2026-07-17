import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { renderToReadableStream, renderToString } from 'react-dom/server';

import State, { Component, Context, Provider } from '@expressive/react';

let existing: Set<Context>;

beforeEach(() => {
  existing = new Set(Context.root.scope);
});

afterEach(() => {
  for (const context of [...Context.root.scope])
    if (!existing.has(context)) context.pop();
});

class Local extends State {
  value = '';
}

function LocalValue({ value }: { value: string }) {
  return <span>{Local.use({ value }).value}</span>;
}

class Message extends State {
  value = '';
}

function MessageValue() {
  return <span>{Message.get().value}</span>;
}

class Greeting extends Component {
  name = '';

  render() {
    return <span>Hello, {this.name}</span>;
  }
}

function Example({ value }: { value: string }) {
  return (
    <>
      <LocalValue value={value} />
      <Provider for={Message} value={`Provided ${value}`}>
        <MessageValue />
      </Provider>
      <Greeting name={value} />
    </>
  );
}

describe('React server rendering', () => {
  it('will render State.use, context, and Component values', () => {
    const html = renderToString(<Example value="server" />);

    expect(html).toContain('<span>server</span>');
    expect(html).toContain('<span>Provided server</span>');
    expect(html).toContain('<span>Hello, <!-- -->server</span>');
  });

  it('will isolate values between sequential renders', () => {
    const first = renderToString(<Example value="first" />);
    const second = renderToString(<Example value="second" />);

    expect(first).toContain('Provided first');
    expect(first).not.toContain('second');
    expect(second).toContain('Provided second');
    expect(second).not.toContain('first');
  });

  it('will select nearest nested Provider', () => {
    const html = renderToString(
      <Provider for={Message} value="outer">
        <MessageValue />
        <Provider for={Message} value="inner">
          <MessageValue />
        </Provider>
        <MessageValue />
      </Provider>
    );

    expect(html).toBe(
      '<span>outer</span><span>inner</span><span>outer</span>'
    );
  });

  it('will render synchronous state through a readable stream', async () => {
    const stream = await renderToReadableStream(<Example value="stream" />);
    await stream.allReady;

    const html = await new Response(stream).text();

    expect(html).toContain('<span>stream</span>');
    expect(html).toContain('<span>Provided stream</span>');
    expect(html).toContain('<span>Hello, <!-- -->stream</span>');
  });
});
