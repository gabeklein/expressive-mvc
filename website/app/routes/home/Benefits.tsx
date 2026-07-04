import type React from 'react';

export function Benefits() {
  return (
    <section className="border-b border-fd-border">
      <div className="mx-auto max-w-(--content-width) py-24 px-6">
        <div className="max-w-2xl mb-16">
          <div className="text-xs leading-[inherit] uppercase tracking-widest text-fd-muted-foreground mb-3">
            What you get
          </div>
          <h2 className="text-3xl md:text-4xl leading-[inherit] md:leading-[inherit] font-bold mb-4">
            A state backbone for your application.
          </h2>
          <p className="text-fd-muted-foreground text-lg leading-[inherit]">
            Expressive is designed to be the place where data, behavior, and
            lifecycle live - so components can go back to doing what they do
            best: describing UI.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Benefit title="Cohesive by default">
            Related state, derived values, lifecycle, and behavior all live in
            one place. Open a class, read it top-to-bottom, understand the
            feature.
          </Benefit>
          <Benefit title="No dependency arrays">
            Computed values and effects track what they read automatically.
            Forgetting a dependency is impossible - you would have to read a
            value without accessing it.
          </Benefit>
          <Benefit title="Testable without rendering">
            State classes are plain objects. Create with .new(), call methods,
            assert properties. No @testing-library, no act(), no DOM.
          </Benefit>
          <Benefit title="Async is built in">
            Async factories integrate with Suspense. Required placeholders
            suspend until resolved. No query library, no middleware, no thunks.
          </Benefit>
          <Benefit title="Type-safe context">
            The class is the context key. No createContext&lt;T&gt;, no default
            values, no manual Provider/Consumer pairs. Full inference
            automatically.
          </Benefit>
          <Benefit title="Coexists with hooks">
            No big-bang rewrite. Migrate one feature at a time. Leave simple
            useState calls alone. Expressive is a tool for complexity, not a
            replacement for hooks.
          </Benefit>
          <Benefit title="Refactor-friendly">
            Rename a field and TypeScript catches every usage. The class is the
            type. Go-to-definition, find-references, and outline views all work
            exactly as you expect.
          </Benefit>
          <Benefit title="AI and human readable">
            Classes are self-contained units with explicit shapes. A reviewer -
            human or AI - can load a feature into memory without chasing hooks
            across files.
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
    <div className="border-l-2 border-fd-primary pl-5">
      <h3 className="text-lg leading-[inherit] font-semibold mb-2">{title}</h3>
      <p className="text-fd-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}
