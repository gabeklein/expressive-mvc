import type React from 'react';
import Reveal from '@/components/Reveal';
import { RainbowText } from './Burst';

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
            Batteries, charger, AND the case included.
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight mb-5">
            Rails for your React app. Free game.
          </h2>
          <p className="text-fd-muted-foreground text-lg md:text-xl">
            MVC covers the stateful behavior you usually rent a library for.
            Forms, tables, modals.... all on the same foundation. The only
            opinions in the building are your own.
          </p>
        </div>

        <div className="mb-14">
          <div className="text-fd-muted-foreground mb-4">
            Fundamentals this strong, you can dead all of these....
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
          <h3 className="font-display text-2xl md:text-3xl font-bold tracking-tight mb-1">
            <RainbowText>Vibe code</RainbowText> that's out here THRIVING.
          </h3>
          <p className="text-fd-muted-foreground mb-5">
            Be honest.... how often do you <i>actually</i> read the diff? LGTM. We all do it.
          </p>
          <p className="text-fd-muted-foreground text-lg mb-5">
            Clear conventions mean a good feature looks the same whether you
            wrote it, your team wrote it, or an agent wrote it. Generated code
            stays readable, so you stay in the conversation.
          </p>
          <p className="text-fd-muted-foreground text-lg">
            And yes, the rainbow is on purpose. This library keeps your state
            out and proud.... no more values hiding in a closure nobody can
            reach. Everything comes out fully typed, and we love that for you. 🏳️‍🌈
          </p>
        </div>

        <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
          <Point title="Business logic that goes crazy (the good kind)" delay={0}>
            State, derived values, async, and lifecycle all live in one crib.
            Composition keeps the concerns separated and readable.
          </Point>
          <Point title="When it breaks, you already know where" delay={200}>
            No dependency arrays, no stale closures, no mystery wiring. The
            fix starts at the class.... not a manhunt.
          </Point>
          <Point title="Type-safe by DEFAULT" delay={100}>
            Classes and TypeScript go together like Miami and sunshine. Types
            and intent live right where the work is.
          </Point>
          <Point title="Instances are just objects, fam" delay={300}>
            The instance is the truth. Log it, assert on it, or slap it on{' '}
            <code>window</code> and interrogate it directly.
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
