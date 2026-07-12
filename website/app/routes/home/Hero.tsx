import State, { Component, get, ref, set } from '@expressive/react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import CopyPill from '@/components/CopyPill';
import Playground from '@/components/Playground';
import code from '@/components/Snippet';

export function Hero() {
  return (
    <section id="hero" className="relative px-6 lg:flex lg:items-center lg:min-h-[calc(100vh-56px)] lg:px-[50px]">
      <Aurora />
      <div className="relative w-full mx-auto max-w-3xl pt-14 pb-16 grid gap-6 sm:pt-18 sm:pb-20 lg:max-w-[1020px] lg:py-24 lg:gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)] lg:items-center">
        <div className="min-w-0 lg:row-start-1">
          <h1 className="font-display tracking-tight mb-6">
            <span className="block whitespace-nowrap text-[clamp(1rem,4.7vw,1.4rem)] font-semibold leading-[1.05] text-fd-foreground/70">
              Clean state management for React
            </span>
            <span className="block mt-4 text-[clamp(1.9rem,9.5vw,3rem)] font-bold leading-[0.98] sm:text-5xl lg:leading-[1.05]">
              <span className="block whitespace-nowrap">More application,</span>
              <span className="block whitespace-nowrap">for less code.</span>
            </span>
          </h1>
          <p className="text-fd-muted-foreground max-w-xl lg:mr-5">
            Expressive MVC moves data, behavior, and lifecycle
            into a focused model. Components stay small, agent code stays
            readable, and apps remain easy to build at scale. The goal is fewer
            lines (and tokens) per feature, and a more pleasant DX.
          </p>
        </div>

        <div className="min-w-0 lg:row-span-2 lg:col-start-2">
          <LiveCounterDemo />
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
          <div className="mx-auto flex max-w-md flex-col gap-2 lg:mx-0">
            <CopyPill label="Add to your app" command="npm install @expressive/react" />
            <CopyPill label="Ask your agent" command="npx skills add gabeklein/expressive-mvc" />
          </div>
          <p className="mx-auto mt-4 max-w-md text-center text-sm text-fd-muted-foreground lg:mx-0">
            Drops into React you already have - not a framework, no rewrite.
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

type TraceStep = 'handler' | 'assignment' | 'field' | 'destructure' | 'jsx' | 'output';
type TraceUpdate = { field: () => void; output: () => void };
type TraceFrame = readonly [delay: number, step?: TraceStep, apply?: keyof TraceUpdate];

const traceTimeline = [
  [0, 'handler'],
  [70, 'assignment'],
  [32, undefined, 'field'],
  [14, 'field'],
  [48, 'destructure'],
  [48, 'jsx'],
  [32, undefined, 'output'],
  [14, 'output'],
  [50],
] as const satisfies readonly TraceFrame[];

const wait = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

class UpdateTrace extends State {
  root = ref<HTMLDivElement>();
  private run = { current: 0 };

  protected new() {
    return () => {
      this.run.current++;
    };
  }

  async play(update: TraceUpdate) {
    const run = ++this.run.current;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      update.field();
      update.output();
      return;
    }

    for (const [delay, step, apply] of traceTimeline) {
      if (delay) await wait(delay);
      if (run !== this.run.current) return;
      if (apply) update[apply]();
      if (step) this.pulse(step);
    }
  }

  private pulse(step: TraceStep) {
    const selector = step === 'output'
      ? '.live-counter-button'
      : `.hero-trace-${step}`;

    for (const element of this.root.current?.querySelectorAll<HTMLElement>(selector) ?? []) {
      element.classList.remove('trace-pulse');
      void element.offsetWidth;
      element.classList.add('trace-pulse');
      element.addEventListener('animationend', () => {
        element.classList.remove('trace-pulse');
      }, { once: true });
    }
  }
}

class LiveCounterDemo extends Component {
  count = 0;
  compact = false;
  trace = new UpdateTrace();

  responsive = ref<HTMLDivElement>(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => (this.compact = media.matches);

    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  });

  render() {
    const { count, compact, responsive, trace: { root } } = this;

    return (
      <div ref={responsive}>
        <div ref={root}>
          <div className={compact ? 'hero-mobile-code code-nowrap' : 'code-nowrap'}>
            <CounterExample compact={compact} count={count} />
          </div>
          <div className="mt-5 flex items-center justify-between gap-4">
            <CounterButton />
            <Playground className="mt-0 mr-2 text-right" to="/examples/essentials/counter" />
          </div>
        </div>
      </div>
    );
  }
}

class CounterButton extends Component {
  demo = get(LiveCounterDemo);

  count = 0;
  hue = 260;
  pulse = 0;
  private pendingCount = 0;

  increment() {
    const count = ++this.pendingCount;
    this.hue = Math.floor(Math.random() * 360);
    this.pulse++;
    this.demo.trace.play({
      field: () => (this.demo.count = count),
      output: () => (this.count = count),
    });
  }

  render() {
    const {
      count,
      hue,
      increment,
      pulse,
    } = this;
    const style = { '--click-hue': hue } as CSSProperties;

    return (
      <div className="shrink-0">
        <button
          onClick={increment}
          style={style}
          className="live-counter-button relative rounded-full border border-fd-border bg-fd-background/70 font-mono text-sm py-2 px-5 hover:bg-fd-muted transition-colors">
          {pulse > 0 && <span key={pulse} aria-hidden className="live-counter-pulse" />}
          <span className="relative">Clicked {count} times</span>
        </button>
      </div>
    );
  }
}

type CounterExampleProps = {
  compact?: boolean;
  count: number;
};

class TypedComment extends State {
  active = set(false, (yes) => yes && this.type());

  value = '';
  private commentTimer?: number;

  protected new() {
    return () => window.clearTimeout(this.commentTimer);
  }

  type() {
    if (this.value || this.commentTimer) return;

    const comment = '// Update values, update components!';
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.value = comment;
      return;
    }

    let length = 0;
    const type = () => {
      this.value = comment.slice(0, ++length);
      this.commentTimer = length < comment.length
        ? window.setTimeout(type, 24)
        : undefined;
    };

    this.commentTimer = window.setTimeout(type, 120);
  }
}

function CounterExample({ compact, count }: CounterExampleProps) {
  const { value } = TypedComment.use({ active: count > 0 });

  const imports =
    "import React from 'react';\n    import State from '@expressive/react';\n\n    ";
  const increment = compact
    ? 'increment() { this.count++; }'
    : 'increment() {\n        this.count++;\n      }';
  const destruct = compact
    ? '{\n        count,\n        increment,\n      }'
    : "{ count, increment }";

  const Example = code /*tsx*/`
    ${imports}class Counter extends State {
      count = ${count};

      ${value}
      ${increment}
    }

    function App() {
      const ${destruct} = Counter.use();

      return (
        <button onClick={increment}>
          Clicked {count} times
        </button>
      );
    }
  `;

  return Example({
    highlight: {
      prefix: 'hero-trace',
      targets: {
        handler: /(?<=onClick=\{)increment/,
        assignment: /this\.count\+\+/,
        field: /count = \d+/,
        destructure: compact ? /count(?=,$)/ : /(?<=\{ )count/,
        jsx: /Clicked \{count\} times/,
      },
    },
  });
}
