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
            Batteries, charger, AND the case included 🔋
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight mb-5">
            Rails for your React app. FREE GAME.
          </h2>
          <p className="text-fd-muted-foreground text-lg md:text-xl">
            MVC covers the stateful ish you been RENTING libraries for.
            Forms, tables, modals.... all one foundation. Only opinions in
            the building are YOURS.
          </p>
        </div>

        <div className="mb-14">
          <div className="text-fd-muted-foreground mb-4">
            Fundamentals so brolic you can dead ALL of these 💀....
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
            <RainbowText>Vibe code</RainbowText> that's out here THRIVINNNNG.
          </h3>
          <p className="text-fd-muted-foreground mb-5">
            Be honest b.... when's the last time you <i>actually</i> read the diff? LGTM 🫡. We ALL do it.
          </p>
          <p className="text-fd-muted-foreground text-lg mb-5">
            Clear conventions mean a good feature look the same whether YOU
            wrote it, ya mans wrote it, or the agent wrote it. Generated code
            stays readable, so you stay in the convo.
          </p>
          <p className="text-fd-muted-foreground text-lg">
            And the rainbow is ON PURPOSE, fam. This library keeps your state
            out and proud.... no more values hiding in a closure nobody can
            reach. Everything comes out fully typed, and we love that for
            you. 🏳️‍🌈 Love is love. State is state. PAUSE.
          </p>
        </div>

        <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
          <Point title="Business logic that goes CRAZYYY (good kind)" delay={0}>
            State, derived values, async, lifecycle.... one crib, all of em.
            Composition keeps it separated and readable. 🧱
          </Point>
          <Point title="When it breaks, you ALREADY know where 🔍" delay={200}>
            No dependency arrays, no stale closures, no mystery wiring. The
            fix starts at the class.... not a whole manhunt.
          </Point>
          <Point title="Type-safe by DEFAULT, no debate" delay={100}>
            Classes and TypeScript go together like a chopped cheese and a
            bodega, deadass. Types and intent live where the work is.
          </Point>
          <Point title="Instances are just objects, son" delay={300}>
            The instance IS the truth. Log it, assert on it, slap it on{' '}
            <code>window</code> and interrogate it like a precinct. 🥷🏽
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
