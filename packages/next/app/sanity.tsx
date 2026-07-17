'use client';

import State, { Component, Provider } from '@expressive/react';
import { use, type ReactNode } from 'react';

class CounterState extends State {
  count = 0;
  mounted = false;

  protected new() {
    this.mounted = true;
  }

  increment() {
    this.count++;
  }
}

export function Counter({ initial }: { initial: number }) {
  const { count, increment, mounted } = CounterState.use({ count: initial });

  return <button data-local-mounted={mounted} onClick={increment}>Count: {count}</button>;
}

class StreamedCounterState extends State {
  count = 0;
  message = '';
}

export function StreamedCounter({
  state
}: {
  state: Promise<{ count: number; message: string }>;
}) {
  const initial = use(state);
  const { count, message } = StreamedCounterState.use(initial);

  return <p data-streamed={count}>{message}</p>;
}

class Message extends State {
  text = '';
  mounted = false;

  protected new() {
    this.mounted = true;
  }
}

export function ContextValue() {
  const { text, mounted } = Message.get();

  return <p data-context={text} data-context-mounted={mounted}>{text}</p>;
}

export function ContextGreeting({ message }: { message: string }) {
  return (
    <Provider for={Message} text={message}>
      <ContextValue />
    </Provider>
  );
}

export function ContextFrame({
  children,
  message
}: {
  children: ReactNode;
  message: string;
}) {
  return (
    <Provider for={Message} text={message}>
      {children}
    </Provider>
  );
}

class Greeting extends Component {
  name = '';
  mounted = false;

  protected new() {
    this.mounted = true;
  }

  render() {
    return <p data-component-mounted={this.mounted}>Hello, {this.name}</p>;
  }
}

export function ClassGreeting({ name }: { name: string }) {
  return <Greeting name={name} />;
}
