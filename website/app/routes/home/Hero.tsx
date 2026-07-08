import State, { ref } from '@expressive/react';
import { Link } from 'react-router';
import CopyPill from '@/components/CopyPill';
import Playground from '@/components/Playground';
import code from '@/components/Snippet';

export function Hero() {
  return (
    <section id="hero" className="relative lg:flex lg:items-center lg:min-h-[calc(100vh-56px)]">
      <Aurora />
      <div className="relative w-full mx-auto max-w-(--content-width) px-6 pt-14 pb-16 grid gap-6 sm:pt-18 sm:pb-20 lg:py-24 lg:gap-12 lg:grid-cols-2 lg:items-center">
        <div className="min-w-0 lg:row-start-1">
          <h1 className="font-display tracking-tight mb-10">
            <span className="block whitespace-nowrap text-[clamp(1rem,4.7vw,1.4rem)] font-semibold leading-[1.05] text-fd-foreground/70">
              Your state shouldn't live in components
            </span>
            <span className="block mt-4 text-[clamp(2.2rem,10.5vw,3rem)] font-bold leading-[0.98] sm:text-5xl lg:leading-[1.05]">
              <span className="block">It belongs to a</span>
              <span className="block">class of its own</span>
            </span>
          </h1>
          <p className="text-fd-muted-foreground max-w-xl lg:mr-5">
            With MVC, <code>.use()</code>{' '}
            your State instead - data, behavior, lifecycle, and updates in one
            place. Components read what they need; class itself does the rest.
          </p>
        </div>

        <div className="min-w-0 lg:row-span-2 lg:col-start-2">
          <div className="hero-mobile-code code-nowrap md:hidden">
            <MobileCounterExample />
          </div>
          <div className="code-nowrap hidden md:block">
            <CounterExample />
          </div>
          <LiveCounter />
          <Playground to="/examples/essentials/counter" />
        </div>

        <div className="lg:row-start-2 lg:col-start-1">
          <div className="flex flex-wrap justify-center gap-3 mt-16 mb-8 lg:justify-start lg:mt-0">
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
            <CopyPill label="Ask your agent" command="npx skills add gabeklein/expressive-mvc" />
          </div>
          <p className="text-sm text-fd-muted-foreground mt-4">
            Drops into React you already have - not a framework, no
            rewrite.
          </p>
        </div>
      </div>
    </section>
  );
}

const btn =
  'inline-flex items-center justify-center rounded-full text-sm font-medium py-2.5 px-5 no-underline transition-[opacity,background-color] duration-200';

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
      <div className="absolute inset-0 opacity-40 sm:opacity-100">
        <div className="aurora absolute -top-48 -left-40 size-[36rem] rounded-full bg-(--accent)/20 blur-3xl" />
        <div className="aurora absolute top-16 -right-40 size-[42rem] rounded-full bg-(--accent)/10 blur-3xl [animation-delay:-9s]" />
        <div className="aurora absolute -bottom-56 left-1/3 size-[32rem] rounded-full bg-(--accent)/15 blur-3xl [animation-delay:-17s]" />
      </div>
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
    <div className="mt-4 rounded-lg border border-fd-border py-3 px-4">
      <div className="text-xs tracking-widest text-fd-muted-foreground mb-3">
        LIVE - the class above, running.
      </div>
      <div className="flex justify-center sm:justify-start">
        <button
          onClick={increment}
          className="rounded-full border border-fd-border font-mono text-sm py-1.5 px-4 hover:bg-fd-muted transition-colors">
          Clicked {count} times
        </button>
      </div>
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

const MobileCounterExample = code /*tsx*/`
  class Counter extends State {
    count = 0;
    increment() { this.count++; }
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
