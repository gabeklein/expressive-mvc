import type React from 'react';

export function Benefits() {
  return (
    <section id="benefits" className="panel">
      <div className="mx-auto max-w-(--content-width) py-16 md:py-24 px-6">
        <div className="max-w-2xl mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">
            The rest comes along for free.
          </h2>
          <p className="text-fd-muted-foreground text-lg">
            Data, behavior, and lifecycle in one place - much of what you'd
            install a library for is just how the class works.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Benefit title="Coexists with hooks">
            No big-bang rewrite. Adopt it one feature at a time and leave simple
            useState calls alone. A tool for complexity, not a replacement.
          </Benefit>
          <Benefit title="Async is built in">
            Async factories integrate with Suspense - required data suspends
            until it resolves. No query library, no middleware, no thunks.
          </Benefit>
          <Benefit title="Self-documenting">
            Fields, types, and JSDoc live on the class, so editors surface intent
            inline. Reusable state your team - and its tools - can reason about
            without digging.
          </Benefit>
          <Benefit title="Headless by design">
            State classes are plain objects - create with .new(), call methods,
            assert on properties. Whole app unit-testable with just expect.
            No @testing-library, no act(), no DOM.
          </Benefit>
        </div>
      </div>
    </section>
  );
}

interface BenefitProps {
  title: string;
  children: React.ReactNode;
}

function Benefit({ title, children }: BenefitProps) {
  return (
    <div className="before:content-[''] before:block before:h-[3px] before:w-full before:rounded-full before:bg-fd-muted-foreground/10 before:mb-4">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-fd-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}
