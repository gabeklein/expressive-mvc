import type React from 'react';

export function Agents() {
  return (
    <section className="border-b border-fd-border">
      <div className="mx-auto max-w-(--content-width) py-24 px-6">
        <div className="max-w-2xl mb-14">
          <div className="text-xs uppercase tracking-widest text-fd-muted-foreground mb-3">
            Built for agents
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight mb-5">
            (Artificially) idiot-proof.
          </h2>
          <p className="text-fd-muted-foreground text-lg md:text-xl">
            The same structure that keeps a codebase legible to people keeps it
            legible to the models working in it. A feature is one class an agent
            can load whole - not hooks and closures to chase across files.
          </p>
        </div>

        <div className="grid gap-x-10 gap-y-8 md:grid-cols-3">
          <Point title="Less to trace">
            State and the logic that owns it sit together. No dependency arrays
            to reason about, no stale-closure hunts - so tokens go to the fix,
            not to reconstructing how the wiring works.
          </Point>
          <Point title="One obvious way">
            Conventions leave fewer decisions about <em>how</em> to build a
            thing. Agents stay on task and converge on small, self-contained
            molecules instead of reinventing patterns.
          </Point>
          <Point title="Just objects">
            State is plain class instances - inspect them, log them, assert on
            them, expose one on <code className={mono}>window</code>. Transparent
            to debug, no framework internals to spelunk.
          </Point>
        </div>
      </div>
    </section>
  );
}

const mono = 'font-mono text-sm bg-fd-muted px-1.5 py-0.5 rounded';

function Point({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-fd-border pt-4">
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-fd-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}
