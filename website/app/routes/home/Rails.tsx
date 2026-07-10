import type React from 'react';
import Reveal from '@/components/Reveal';

const SHED = [
  'swr', 'react-error-boundary', 'immer', 'use-context-selector',
  'formik', 'use-local-storage', 'react-query', 'react-hook-form',
  'usehooks-ts', 'use-debounce',
];

export function Rails() {
  return (
    <section id="rails" className="panel px-6 lg:px-[50px]">
      <div className="mx-auto max-w-(--content-width) py-16 md:py-24">
        <div className="max-w-2xl mb-12">
          <div className="text-xs uppercase tracking-widest text-fd-primary mb-3">
            Batteries (and charger) included.
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight mb-5">
            Rails for your React app.
          </h2>
          <p className="text-fd-muted-foreground text-lg md:text-xl">
            MVC covers stateful behavior you normally need a library for.
            Build forms, tables, and modals on the same foundation -
            install a specialist where it earns its place.
          </p>
        </div>

        <div className="mb-14">
          <div className="text-fd-muted-foreground mb-4">
            With strong fundamentals, you stop reaching for
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
            <span className="text-fd-foreground/80">(Artificial)</span> Idiot-Proof.
          </h3>
          <p className="text-fd-muted-foreground text-lg">
            Clear conventions mean a good feature looks the same, whether
            written by you, your team, or an agent. Fewer one-off decisions
            keep agents focused and on-task.
          </p>
        </div>

        <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
          <Point title="Dense business logic" delay={0}>
            State, derived values, async, and lifecycle live together.
            Composition helps separate concerns into readable chunks.
          </Point>
          <Point title="Type-safe as a rule" delay={100}>
            Classes pair naturally with TypeScript and JSDoc, so editors
            surface types and intent where the work is.
          </Point>
          <Point title="Less to trace when things break" delay={200}>
            No dependency arrays, stale closures, or complicated interactions.
            A fix starts at the class, not a hunt through wiring.
          </Point>
          <Point title="Class instances are just objects" delay={300}>
            The instance is the source of truth. Log it, assert on it, or bind
            it to <code>window</code> to inspect directly.
          </Point>
        </div>
      </div>
    </section>
  );
}

function Point({
  title,
  children,
  delay,
}: {
  title: string;
  children: React.ReactNode;
  delay: number;
}) {
  return (
    <Reveal
      delay={delay}
      className="before:content-[''] before:block before:h-[3px] before:w-full before:rounded-full before:bg-fd-primary/10 before:mb-4">
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-fd-muted-foreground leading-relaxed">{children}</p>
    </Reveal>
  );
}
