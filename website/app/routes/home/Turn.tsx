import type React from 'react';

const SHED = [
  'redux', 'zustand', 'react-query', 'swr',
  'react-hook-form', 'reselect', 'use-context-selector',
];

export function Turn() {
  return (
    <section className="border-b border-fd-border bg-fd-muted/30">
      <div className="mx-auto max-w-(--content-width) py-24 px-6">
        <div className="max-w-2xl mb-14">
          <div className="text-xs uppercase tracking-widest text-fd-primary mb-3">
            Convention over configuration
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight mb-5">
            Rails for your React app.
          </h2>
          <p className="text-fd-muted-foreground text-lg md:text-xl">
            Fields are state, methods change it, the class is the context key. A
            few conventions replace a pile of decisions - so a feature looks the
            same whether you wrote it, a teammate did, or an agent did. Organized
            code stays easy to extend instead of seizing up.
          </p>
        </div>

        <div className="grid gap-x-10 gap-y-8 md:grid-cols-3 mb-16">
          <Pillar title="One place for everything">
            State, computed values, async, and lifecycle live on the class - not
            scattered across hooks, effects, and refs.
          </Pillar>
          <Pillar title="Conventions, not decisions">
            No store to configure, no context to wire, no dependency arrays to
            keep honest. Learn the shape once and apply it everywhere.
          </Pillar>
          <Pillar title="Grows without tangling">
            A new feature is a new field or method - not an afternoon spent
            untangling the ones already there.
          </Pillar>
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
        <p className="text-sm text-fd-muted-foreground mt-5">
          Dependencies you stop reaching for - the batteries are included.
        </p>
      </div>
    </section>
  );
}

function Pillar({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-fd-primary/40 pt-4">
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-fd-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}
