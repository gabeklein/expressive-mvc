import Compare from '@/components/Compare';
import code from '@/components/Snippet';

export function Context() {
  return (
    <section className="border-b border-fd-border bg-fd-muted/30">
      <div className="mx-auto max-w-(--content-width) px-6 py-24">
        <div className="max-w-2xl mb-12">
          <div className="text-xs uppercase tracking-widest text-fd-primary mb-3">
            Shared state
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">
            The class is the context key.
          </h2>
          <p className="text-fd-muted-foreground text-lg">
            A child needs the theme its parent owns.{' '}
            <code className={mono}>get(Theme)</code> walks up the tree and finds
            it - fully typed, no wiring.
          </p>
        </div>

        <Compare
          left={{ label: 'get(Theme)', code: ExprCode }}
          right={[{ label: 'React Context', code: ReactCode }]}
        />

        <p className="text-fd-muted-foreground text-lg leading-relaxed max-w-3xl mx-auto mt-10 text-center">
          No <code className={mono}>createContext&lt;T&gt;</code>, no null default,
          no missing-provider guard, no Provider/Consumer pair to keep in sync.
          The class is its own key, and <code className={mono}>Panel</code> pulls
          state from context exactly the way it reads its own fields.
        </p>
      </div>
    </section>
  );
}

const mono = 'font-mono text-sm bg-fd-muted px-1.5 py-0.5 rounded';

const ExprCode = code /*tsx*/`
  import State, { get } from '@expressive/react';

  class Theme extends State {
    mode = 'light';

    toggle() {
      this.mode = this.mode === 'light' ? 'dark' : 'light';
    }
  }

  class Panel extends State {
    theme = get(Theme);

    get dark() {
      return this.theme.mode === 'dark';
    }
  }
`;

const ReactCode = code /*tsx*/`
  import { createContext, useContext, useState } from 'react';

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

  function usePanel() {
    const theme = useContext(ThemeContext);

    if (!theme)
      throw new Error('ThemeProvider missing');

    return { dark: theme.mode === 'dark' };
  }
`;
