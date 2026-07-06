import State, { ref } from '@expressive/react';
import { Link } from 'react-router';
import CopyPill from '@/components/CopyPill';
import code from '@/components/Snippet';

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <Aurora />
      <div className="relative mx-auto max-w-(--content-width) px-6 py-24 md:py-32 grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <div className="text-xs uppercase tracking-widest text-fd-muted-foreground mb-5">
            Class-based control for React
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-6">
            State doesn't belong in your components.
          </h1>
          <p className="text-lg md:text-xl text-fd-muted-foreground max-w-xl mb-8">
            Just <code className="font-mono text-[0.9em] bg-fd-muted px-1.5 py-0.5 rounded">use()</code>{' '}
            a State instead - data, behavior, and lifecycle in one place.
            Components read what they need and update when it changes.
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
          <p className="text-sm text-fd-muted-foreground mt-4">
            Drops into the React app you already have - not a framework, not a
            rewrite.
          </p>
        </div>

        <div className="min-w-0">
          <div className="code-nowrap">
            <CounterExample />
          </div>
          <LiveCounter />
        </div>
      </div>
    </section>
  );
}

const btn =
  'inline-flex items-center justify-center rounded-full font-medium py-3 px-6 no-underline transition-[opacity,background-color] duration-200';

class Parallax extends State {
  layer = ref<HTMLDivElement>((el) => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      el.style.transform = `translateY(${y * 0.4}px)`;
      el.style.opacity = String(Math.max(0, 1 - y / (window.innerHeight * 0.9)));
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    update();

    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  });
}

function Aurora() {
  const { layer } = Parallax.use();

  return (
    <div
      ref={layer}
      aria-hidden
      className="absolute inset-0 overflow-hidden [mask-image:linear-gradient(to_bottom,black,black_60%,transparent)]">
      <div className="aurora absolute -top-48 -left-40 size-[36rem] rounded-full bg-(--accent)/20 blur-3xl" />
      <div className="aurora absolute top-16 -right-40 size-[42rem] rounded-full bg-(--accent)/10 blur-3xl [animation-delay:-9s]" />
      <div className="aurora absolute -bottom-56 left-1/3 size-[32rem] rounded-full bg-(--accent)/15 blur-3xl [animation-delay:-17s]" />
    </div>
  );
}

class Counter extends State {
  count = 0;

  increment() {
    this.count++;
  }
}

function LiveCounter() {
  const { count, increment } = Counter.use();

  return (
    <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-fd-border py-3 px-4">
      <span className="text-xs uppercase tracking-widest text-fd-muted-foreground">
        Live - this exact class
      </span>
      <button
        onClick={increment}
        className="rounded-full border border-fd-border font-mono text-sm py-1.5 px-4 hover:bg-fd-muted transition-colors">
        Clicked {count} times
      </button>
    </div>
  );
}

const CounterExample = code /*tsx*/`
  import React from 'react';
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
