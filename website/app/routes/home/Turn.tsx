const SHED = [
  'redux', 'zustand', 'jotai', 'react-query', 'swr',
  'react-hook-form', 'reselect', 'immer', 'use-context-selector',
];

export function Turn() {
  return (
    <section className="border-b border-fd-border bg-fd-muted/30">
      <div className="mx-auto max-w-(--content-width) py-24 px-6 text-center">
        <div className="text-xs uppercase tracking-widest text-fd-primary mb-4">
          The idea
        </div>
        <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight mb-6">
          Rails for your React app.
        </h2>
        <p className="text-fd-muted-foreground text-lg md:text-xl max-w-2xl mx-auto mb-12">
          Batteries included, convention over ceremony. The state, async,
          context, and lifecycle you'd otherwise assemble from a dozen libraries
          - one class, one import.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-2xl mx-auto">
          {SHED.map((name) => (
            <span
              key={name}
              className="rounded-full border border-fd-border font-mono text-sm text-fd-muted-foreground/60 line-through py-1.5 px-3.5">
              {name}
            </span>
          ))}
        </div>
        <p className="text-sm text-fd-muted-foreground mt-6">
          Dependencies you stop reaching for.
        </p>
      </div>
    </section>
  );
}
