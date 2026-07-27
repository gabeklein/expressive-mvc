import type React from 'react';
import Reveal from '@/components/Reveal';

export function Benefits() {
  return (
    <section id="benefits" className="panel px-6 lg:px-[50px]">
      <div className="mx-auto max-w-(--content-width) py-16 md:py-24">
        <div className="max-w-2xl mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">
            A layer, not a leap. Facts.
          </h2>
          <p className="text-fd-muted-foreground text-lg">
            Start with the feature that's already hurting and leave the rest
            alone. MVC rides with the React app and tools you already have.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Benefit title="One feature at a time" delay={0}>
            No big-bang rewrite. Adopt it where it counts and leave the simple
            useState calls alone.... a tool for complexity, not a replacement.
          </Benefit>
          <Benefit title="Keep what's still eating" delay={100}>
            MVC doesn't need to replace every hook or specialist library.
            The tools still earning their spot? They stay.
          </Benefit>
          <Benefit title="State that travels" delay={200}>
            Headless State classes don't care about a component tree. Move
            them, test them, run the framework-agnostic core wherever.
          </Benefit>
          <Benefit title="No build-time magic" delay={300}>
            No compiler, no code generation, no custom syntax. What you write
            is what runs. Zero cap.
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
