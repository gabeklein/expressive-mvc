import { Link } from 'react-router';
import CopyPill from '@/components/CopyPill';
import code from '@/components/Snippet';

export function Hero() {
  return (
    <section className="border-b border-fd-border">
      <div className="mx-auto max-w-(--content-width) px-6 py-24 md:py-32 grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <div className="text-xs uppercase tracking-widest text-fd-muted-foreground mb-5">
            Class-based reactive state for React
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-6">
            State doesn't belong in your components.
          </h1>
          <p className="text-lg md:text-xl text-fd-muted-foreground max-w-xl mb-8">
            Expressive MVC is the backbone for your React app - state, async,
            context, and lifecycle in plain typed classes your components simply
            read. No hooks to wire, no stores to configure, no prop drilling.
          </p>

          <div className="flex flex-wrap gap-3 mb-8">
            <Link
              className={`${btn} bg-fd-primary text-fd-primary-foreground hover:opacity-90`}
              to="/docs/getting-started">
              Get Started
            </Link>
            <Link
              className={`${btn} border border-fd-border text-inherit hover:bg-fd-muted`}
              to="/docs">
              View Docs
            </Link>
          </div>

          <div className="flex flex-col gap-2 max-w-md">
            <CopyPill label="Add to your app" command="npm install @expressive/react" />
            <CopyPill label="Teach your agent" command="npx skills add gabeklein/expressive-mvc" />
          </div>
        </div>

        <div className="min-w-0">
          <CounterExample />
        </div>
      </div>
    </section>
  );
}

const btn =
  'inline-flex items-center justify-center rounded-full font-medium py-3 px-6 no-underline transition-[opacity,background-color] duration-200';

const CounterExample = code /*tsx*/`
  import State from '@expressive/react';

  class Counter extends State {
    count = 0;

    increment() {
      this.count++;
    }
  }

  function App() {
    const { count, increment } = Counter.use();

    return (
      <button onClick={increment}>
        Clicked {count} times
      </button>
    );
  }
`;
