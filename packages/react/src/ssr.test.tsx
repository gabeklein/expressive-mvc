import { expect, it } from 'bun:test';
import { renderToString } from 'react-dom/server';

import { Component, Context, Provider, State } from '.';
import { observer } from '@expressive/mvc/observable';

it('will prepare state without running mount lifecycle', () => {
  const existing = new Set(Context.root.scope);
  const started: State[] = [];
  let local!: LocalState;
  let provided!: ProvidedState;
  let component!: LifecycleComponent;

  class LocalState extends State {
    value = 'local';

    protected new() {
      started.push(this);
    }
  }

  class ProvidedState extends State {
    value = '';

    protected new() {
      started.push(this);
    }
  }

  class LifecycleComponent extends Component {
    value = '';

    protected new() {
      started.push(this);
    }

    render() {
      return <span>{this.value}</span>;
    }
  }

  function LocalView() {
    return <span>{LocalState.use((state) => { local = state; }).value}</span>;
  }

  function ProvidedView() {
    return <span>{ProvidedState.get().value}</span>;
  }

  try {
    const html = renderToString(
      <>
        <LocalView />
        <Provider
          for={ProvidedState}
          value="provided"
          is={(state) => { provided = state; }}
        >
          <ProvidedView />
        </Provider>
        <LifecycleComponent
          value="component"
          is={(state: LifecycleComponent) => { component = state; }}
        />
      </>
    );

    expect(html).toContain('<span>local</span>');
    expect(html).toContain('<span>provided</span>');
    expect(html).toContain('<span>component</span>');
    expect(started).toEqual([]);
    expect(observer(local)?.ready).toBeUndefined();
    expect(observer(provided)?.ready).toBeUndefined();
    expect(observer(component)?.ready).toBeUndefined();
  } finally {
    for (const context of [...Context.root.scope])
      if (!existing.has(context)) context.pop();
  }
});
