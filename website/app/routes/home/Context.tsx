import State, { Component, get, ref, use } from '@expressive/react';
import { Moon, Sun } from 'lucide-react';
import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import Playground from '@/components/Playground';
import code from '@/components/Snippet';

export function Context() {
  return (
    <section id="context" className="panel px-6 lg:px-[50px]">
      <div className="mx-auto max-w-(--content-width) py-16 md:py-24">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Classes have context.
          </h2>
          <p className="text-fd-muted-foreground text-lg">
            Wrap a subtree in <code>&lt;Provider for=&#123;X&#125;&gt;</code> - 
            components inside need only <code>X.get()</code>{' '}
            to interact with the nearest instance. Fully typed, zero ceremony.
          </p>
        </div>

        <ThemeDemo />

        <p className="text-fd-muted-foreground text-lg leading-relaxed max-w-3xl mx-auto mt-10 text-center">
          No <code>createContext&lt;T&gt;</code>, null default,
          missing-provider guard to write and maintain. Every app needs this eventually. Jotai's Provider will wrap a whole atom
          store, MobX leaves it to you.
        </p>
      </div>
    </section>
  );
}

type Mode = 'light' | 'dark';
type ThemeStep = 'handler' | 'assignment' | 'field' | 'destructure' | 'jsx';

const themeTimeline = [
  [0, 'handler'],
  [70, 'assignment'],
  [14, 'field'],
  [48, 'destructure'],
  [48, 'jsx'],
  [50],
] as const;

const wait = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

class ThemeTrace extends State {
  root = ref<HTMLDivElement>();
  private run = { current: 0 };

  protected new() {
    return () => {
      this.run.current++;
    };
  }

  async play() {
    const run = ++this.run.current;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    for (const [delay, step] of themeTimeline) {
      if (delay) await wait(delay);
      if (run !== this.run.current) return;
      if (step) this.pulse(step);
    }
  }

  private pulse(step: ThemeStep) {
    for (const element of this.root.current?.querySelectorAll<HTMLElement>(`.context-trace-${step}`) ?? []) {
      element.classList.remove('trace-pulse');
      void element.offsetWidth;
      element.classList.add('trace-pulse');
      element.addEventListener('animationend', () => {
        element.classList.remove('trace-pulse');
      }, { once: true });
    }
  }
}

class ThemeDemo extends Component {
  mode: Mode = 'light';
  trace = new ThemeTrace();

  render() {
    const { mode, trace: { root } } = this;

    return (
      <div ref={root} className="mx-auto grid w-fit max-w-full items-center gap-7 md:grid-cols-[minmax(0,max-content)_8rem] md:gap-10">
        <div className="code-nowrap min-w-0 w-fit max-w-full">
          <ExprCode mode={mode} />
          <Playground to="/examples/composition/context" />
        </div>
        <ThemeControl />
      </div>
    );
  }
}

class ThemeControl extends Component {
  demo = get(ThemeDemo);

  toggle(setTheme: (mode: Mode) => void) {
    const mode = this.demo.mode === 'light' ? 'dark' : 'light';
    setTheme(mode);
    this.demo.mode = mode;
    this.demo.trace.play();
  }

  render() {
    return <ThemeButton control={this} />;
  }
}

function ThemeButton({ control }: { control: ThemeControl }) {
  const { resolvedTheme, setTheme } = useTheme();
  const { demo: { mode }, toggle } = use(control);

  useEffect(() => {
    if (resolvedTheme === 'light' || resolvedTheme === 'dark') {
      control.demo.mode = resolvedTheme;
    }
  }, [control, resolvedTheme]);

  const Icon = mode === 'light' ? Sun : Moon;

  return (
    <div className="theme-demo-control flex flex-col items-center justify-center justify-self-center rounded-xl p-2">
      <button
        type="button"
        aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
        onClick={() => toggle(setTheme)}
        className="flex size-16 cursor-pointer items-center justify-center rounded-full border border-fd-border bg-fd-background shadow-sm transition-colors hover:bg-fd-muted">
        <Icon aria-hidden className="size-7" />
      </button>
      <span className="mt-2 font-mono text-sm text-fd-muted-foreground">{mode} mode</span>
    </div>
  );
}

function ExprCode({ mode }: { mode: Mode }) {
  const Example = code /*tsx*/`
    import React from 'react';
    import State, { Provider } from '@expressive/react';

    class Theme extends State {
      mode = '${mode}';

      toggle() {
        this.mode = this.mode === 'light' ? 'dark' : 'light';
      }
    }

    const Toggle = () => {
      const { mode, toggle } = Theme.get();

      return <button onClick={toggle}>{mode} mode</button>;
    }

    const App = () => (
      <Provider for={Theme}>
        <Toggle />
      </Provider>
    );
  `;

  return Example({
    highlight: {
      prefix: 'context-trace',
      targets: {
        handler: /(?<=onClick=\{)toggle/,
        assignment: /this\.mode = this\.mode[^;]+/,
        field: /mode = '(?:light|dark)'/,
        destructure: /mode(?=, toggle)/,
        jsx: /\{mode\} mode/,
      },
    },
  });
}
