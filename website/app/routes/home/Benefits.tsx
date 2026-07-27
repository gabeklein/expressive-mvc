import type React from 'react';
import Reveal from '@/components/Reveal';

export function Benefits() {
  return (
    <section id="benefits" className="panel px-6 lg:px-[50px]">
      <div className="mx-auto max-w-(--content-width) py-16 md:py-24">
        <div className="max-w-2xl mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">
            A layer, not a leap. FACTS. 🗽
          </h2>
          <p className="text-fd-muted-foreground text-lg">
            Start with the feature that's ALREADY hurting and leave the rest
            alone. MVC rides with the React app and tools you already got.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Benefit title="One feature at a time" delay={0}>
            No big-bang rewrite, no demolition. Adopt it where it counts,
            leave the simple useState calls alone.... a tool for complexity,
            not a replacement. 🧰
          </Benefit>
          <Benefit title="Keep what's still eating 🍽️" delay={100}>
            MVC doesn't need to replace every hook or specialist library.
            The tools still earning they spot? They STAY.
          </Benefit>
          <Benefit title="State that travels" delay={200}>
            Headless State classes don't care about a component tree,
            deadass. Move em, test em, run the framework-agnostic core
            wherever. ✈️
          </Benefit>
          <Benefit title="No build-time magic" delay={300}>
            No compiler, no codegen, no custom syntax. What you write is what
            runs. ZERO cap. 🚫🧢
          </Benefit>
        </div>
      </div>
    </section>
  );
}

interface BenefitProps {
  title: string;
  children: React.ReactNode;
  delay: number;
}

function Benefit({ title, children, delay }: BenefitProps) {
  return (
    <Reveal
      delay={delay}
      className="before:content-[''] before:block before:h-[3px] before:w-full before:rounded-full before:bg-fd-muted-foreground/10 before:mb-4">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-fd-muted-foreground leading-relaxed">{children}</p>
    </Reveal>
  );
}
