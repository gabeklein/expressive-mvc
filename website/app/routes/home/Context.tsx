import Playground from '@/components/Playground';
import code from '@/components/Snippet';

export function Context() {
  return (
    <section id="context" className="panel">
      <div className="mx-auto max-w-(--content-width) px-6 py-16 md:py-24">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Classes are their own context.
          </h2>
          <p className="text-fd-muted-foreground text-lg">
            Wrap a subtree in <code>&lt;Provider for=&#123;X&#125;&gt;</code> - 
            components inside need only <code>X.get()</code>{' '}
            to interact with nearest instance. Fully typed, zero boilerplate.
          </p>
        </div>

        <div className="code-nowrap max-w-3xl mx-auto">
          <ExprCode />
          <Playground to="/examples/composition/context" />
        </div>

        <p className="text-fd-muted-foreground text-lg leading-relaxed max-w-3xl mx-auto mt-10 text-center">
          No <code>createContext&lt;T&gt;</code>, null default,
          missing-provider guard to write and maintain. Every app needs this eventually. Jotai's Provider will wrap a whole atom
          store, MobX leaves it to you entirely.
        </p>
      </div>
    </section>
  );
}

const ExprCode = code /*tsx*/`
  import React from 'react';
  import State, { Provider } from '@expressive/react';

  class Theme extends State {
    mode = 'light';

    toggle() {
      this.mode = this.mode === 'light' ? 'dark' : 'light';
    }
  }

  const Toggle = () => {
    const { mode, toggle } = Theme.get();

    return <button onClick={toggle}>{mode}</button>;
  }

  const App = () => (
    <Provider for={Theme}>
      <Toggle />
    </Provider>
  );
`;

