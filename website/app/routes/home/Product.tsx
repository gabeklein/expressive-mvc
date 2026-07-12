import type React from 'react';
import Reveal from '@/components/Reveal';

export function Product() {
  return (
    <section id="product" className="panel px-6 lg:px-[50px]">
      <div className="mx-auto grid max-w-(--content-width) gap-12 py-16 md:py-24 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-20">
        <div className="max-w-2xl lg:self-center">
          <div className="mb-3 text-xs uppercase tracking-widest text-fd-primary">
            What Expressive adds
          </div>
          <h2 className="mb-5 font-display text-3xl font-bold tracking-tight md:text-4xl">
            React renders your app.<br /> MVC keeps it organized.
          </h2>
          <p className="text-lg leading-relaxed text-fd-muted-foreground">
            Expressive MVC is a model layer for React. It gives data, async and
            side effects a home away from display logic.
            React keeps doing what it's good at, while the
            logic behind it becomes easier to read, write, and test.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:gap-x-8">
          <Point title="Smaller components" delay={0}>
            Components focus on rendering instead of coordinating
            features.
          </Point>
          <Point title="Minimal boilerplate" delay={100}>
            State classes read like normal JavaScript, even when they power
            complex logic and UI.
          </Point>
          <Point title="Output you can read" delay={200}>
            When an agent writes the feature, related logic stays together -
            easier to extend.
          </Point>
          <Point title="Separation built in" delay={300}>
            Built-in context keeps models separate without prop drilling, so
            growth isn't tech debt.
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
    <Reveal delay={delay} className="border-t border-fd-border pt-4">
      <h3 className="mb-2 font-semibold">{title}</h3>
      <p className="text-sm leading-relaxed text-fd-muted-foreground sm:text-base">
        {children}
      </p>
    </Reveal>
  );
}
