import Playground from '@/components/Playground';
import code from '@/components/Snippet';

export function Context() {
  return (
    <section id="context" className="panel">
      <div className="mx-auto max-w-(--content-width) px-6 py-16 md:py-24">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Your classes themselves have context.
          </h2>
          <p className="text-fd-muted-foreground text-lg">
            Wrap a subtree in <code className={mono}>&lt;Provider for=&#123;X&#125;&gt;</code> and
            anything below just asks: <code className={mono}>X.get()</code>{' '}
            finds the nearest instance. Fully typed, no wiring.
          </p>
        </div>

        <div className="code-nowrap max-w-3xl mx-auto">
          <ExprCode />
          <Playground to="/examples/composition/context" />
        </div>

        <p className="text-fd-muted-foreground text-lg leading-relaxed max-w-3xl mx-auto mt-10 text-center">
          No <code className={mono}>createContext&lt;T&gt;</code>, null default,
          missing-provider guard, or Provider-Consumer pair to keep in sync.
          <br /><br />
          Every library lands back here eventually - Zustand has you wrap a
          store in React context yourself, Jotai's Provider scopes a whole atom
          store, MobX leaves it to you entirely.
        </p>
      </div>
    </section>
  );
}

const mono = 'font-mono text-sm bg-fd-muted px-1.5 py-0.5 rounded';

const ExprCode = code /*tsx*/`
  import React from 'react';
  import State, { Provider } from '@expressive/react';

  class Theme extends State {
    mode = 'light';

    toggle() {
      this.mode = this.mode === 'light' ? 'dark' : 'light';
    }
  }

  function ModeBadge() {
    const { mode, toggle } = Theme.get();

    return <button onClick={toggle}>{mode}</button>;
  }

  function App() {
    return (
      <Provider for={Theme}>
        <ModeBadge />
      </Provider>
    );
  }
`;

