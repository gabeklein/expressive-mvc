import type React from 'react';
import Reveal from '@/components/Reveal';
import { RainbowText } from './Burst';

export function Vibe() {
  return (
    <section id="vibe" className="panel px-6 lg:px-[50px]">
      <div className="mx-auto max-w-(--content-width) py-16 md:py-24">
        <div className="max-w-2xl mb-12">
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight mb-5">
            <RainbowText>Vibe code</RainbowText> you can keep.
          </h2>
          <p className="text-fd-muted-foreground text-lg md:text-xl">
            Clear conventions mean a good feature looks the same, whether
            written by you, your team, or an agent. Generated code stays
            readable, with less to trace when things break.
          </p>
        </div>

        <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
          <Point title="Dense business logic" delay={0}>
            State, derived values, async, and lifecycle live together.
            Composition helps separate concerns into readable chunks.
          </Point>
          <Point title="Less to trace when things break" delay={200}>
            No dependency arrays, stale closures, or complicated interactions.
            A fix starts at the class, not a hunt through wiring.
          </Point>
          <Point title="Type-safe as a rule" delay={100}>
            Classes pair naturally with TypeScript and JSDocs, to
            surface types and intent where the work is.
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
