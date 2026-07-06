import Compare from '@/components/Compare';
import Playground from '@/components/Playground';
import code from '@/components/Snippet';

export function Context() {
  return (
    <section>
      <div className="mx-auto max-w-(--content-width) px-6 py-24">
        <div className="max-w-2xl mb-12">
          <div className="text-xs uppercase tracking-widest text-fd-primary mb-3">
            Shared state
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Your classes themselves have context.
          </h2>
          <p className="text-fd-muted-foreground text-lg">
            Wrap a subtree in <code className={mono}>&lt;Provider&gt;</code> and
            anything below just asks: <code className={mono}>Theme.get()</code>{' '}
            finds the nearest instance. Fully typed, no wiring.
          </p>
        </div>

        <Compare
          left={{ label: 'Theme.get()', code: ExprCode }}
          right={[
            { label: 'React Context', code: ReactCode },
            { label: 'Zustand', code: ZustandCode },
            { label: 'Jotai', code: JotaiCode },
          ]}
        />

        <Playground to="/examples/composition/context" />

        <p className="text-fd-muted-foreground text-lg leading-relaxed max-w-3xl mx-auto mt-10 text-center">
          No <code className={mono}>createContext&lt;T&gt;</code>, no null default,
          no missing-provider guard, no Provider/Consumer pair to keep in sync.
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

const ReactCode = code /*tsx*/`
  import React, { createContext, useContext, useState } from 'react';

  const ThemeContext = createContext<{
    mode: string;
    toggle: () => void;
  } | null>(null);

  function ThemeProvider({ children }) {
    const [mode, setMode] = useState('light');

    const toggle = () =>
      setMode(m => (m === 'light' ? 'dark' : 'light'));

    return (
      <ThemeContext.Provider value={{ mode, toggle }}>
        {children}
      </ThemeContext.Provider>
    );
  }

  function ModeBadge() {
    const theme = useContext(ThemeContext);

    if (!theme)
      throw new Error('ThemeProvider missing');

    return <button onClick={theme.toggle}>{theme.mode}</button>;
  }
`;

const JotaiCode = code /*tsx*/`
  import { atom, createStore, Provider, useAtom } from 'jotai';
  import React, { useState } from 'react';

  const modeAtom = atom('light');

  function ThemeProvider({ children }) {
    const [store] = useState(() => createStore());

    return (
      <Provider store={store}>
        {children}
      </Provider>
    );
  }

  function ModeBadge() {
    const [mode, setMode] = useAtom(modeAtom);

    const toggle = () =>
      setMode(m => (m === 'light' ? 'dark' : 'light'));

    return <button onClick={toggle}>{mode}</button>;
  }

  // note: the Provider scopes every atom in the
  // subtree to this store, not just the theme
`;

const ZustandCode = code /*tsx*/`
  import React, { createContext, useContext, useState } from 'react';
  import { createStore, useStore } from 'zustand';

  const ThemeContext = createContext(null);

  const makeTheme = () => createStore(set => ({
    mode: 'light',
    toggle: () => set(s =>
      ({ mode: s.mode === 'light' ? 'dark' : 'light' })),
  }));

  function ThemeProvider({ children }) {
    const [store] = useState(makeTheme);

    return (
      <ThemeContext.Provider value={store}>
        {children}
      </ThemeContext.Provider>
    );
  }

  function ModeBadge() {
    const store = useContext(ThemeContext);

    if (!store)
      throw new Error('ThemeProvider missing');

    const { mode, toggle } = useStore(store);

    return <button onClick={toggle}>{mode}</button>;
  }
`;
