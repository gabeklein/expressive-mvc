import type React from 'react';

export function Benefits() {
  return (
    <section className="bg-fd-foreground/[0.04]">
      <div className="mx-auto max-w-(--content-width) py-24 px-6">
        <div className="max-w-2xl mb-16">
          <div className="text-xs uppercase tracking-widest text-fd-muted-foreground mb-3">
            What you get
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">
            The rest comes along for free.
          </h2>
          <p className="text-fd-muted-foreground text-lg">
            With data, behavior, and lifecycle in one place, a lot of what you'd
            normally reach for a library or a pattern to solve is just how the
            class already works.
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
            assert on properties. No @testing-library, no act(), no DOM. And it
            goes further: logic that never touches the render layer can run
            anywhere, so the classes driving your UI today can power a test
            suite, a CLI, or an entirely different renderer tomorrow.
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
    <div className="before:content-[''] before:block before:h-[3px] before:w-full before:rounded-full before:bg-fd-muted-foreground/30 before:mb-4">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-fd-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}
