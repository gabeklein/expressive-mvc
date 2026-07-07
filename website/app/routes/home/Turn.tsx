import type React from 'react';

const SHED = [
  'swr', 'react-error-boundary', 'immer', 'use-context-selector',
  'formik', 'use-local-storage', 'react-query', 'react-hook-form',
  'usehooks-ts', 'use-debounce',
];

export function Turn() {
  return (
    <section id="rails" className="panel">
      <div className="mx-auto max-w-(--content-width) py-16 md:py-24 px-6">
        <div className="max-w-2xl mb-12">
          <div className="text-xs uppercase tracking-widest text-fd-primary mb-3">
            Batteries (and charger) included.
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight mb-5">
            Rails for your React app.
          </h2>
          <p className="text-fd-muted-foreground text-lg md:text-xl">
            Fields are state, methods change it, classes are context keys. A few
            conventions replace a pile of decisions - a good feature looks the same
            whether it came from you, a teammate, or an agent.
          </p>
        </div>

        <div className="mb-14">
          <div className="text-xs uppercase tracking-widest text-fd-muted-foreground mb-4">
            You stop reaching for
          </div>
          <div className="flex flex-wrap items-center gap-2.5 max-w-3xl">
            {SHED.map((name) => (
              <span
                key={name}
                className="rounded-full border border-fd-border font-mono text-sm text-fd-muted-foreground/60 line-through py-1.5 px-3.5">
                {name}
              </span>
            ))}
          </div>
        </div>

        <div className="max-w-2xl mb-10">
          <h3 className="font-display text-2xl md:text-3xl font-bold tracking-tight mb-3">
            <span className="text-fd-foreground/70">(Artificial)</span> Idiot-Proof.
          </h3>
          <p className="text-fd-muted-foreground text-lg">
            The same structure keeps the models working in your codebase on
            task - a feature is one class an agent can load whole.
          </p>
        </div>

        <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
          <Point title="Dense business logic">
            State, derived values, async, and lifecycle live in classes.
            Composition helps separate concerns into readable chunks.
          </Point>
          <Point title="Fewer imports, less lock-in">
            Reach for the class before another hook, provider, or client
            library. Less surface area for people and your agents to know about.
          </Point>
          <Point title="Less to trace when things break">
            No dependency arrays, stale closures, or complicated interactions.
            A fix starts at the class, not a hunt through wiring.
          </Point>
          <Point title="Class instances are just objects">
            The instance is the source of truth. Log it, assert on it, or bind
            it to <code>window</code> and inspect it directly.
          </Point>
        </div>
      </div>
    </section>
  );
}

function Point({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="before:content-[''] before:block before:h-[3px] before:w-full before:rounded-full before:bg-fd-primary/10 before:mb-4">
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-fd-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}
