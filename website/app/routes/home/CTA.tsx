import { Link } from 'react-router';
import CopyPill from '@/components/CopyPill';

export function CTA() {
  const link =
    'inline-flex items-center justify-center rounded-full font-medium py-3 px-6 no-underline transition-[opacity,background-color] duration-200';

  return (
    <section id="cta" className="panel px-6 lg:px-[50px]">
      <div className="mx-auto max-w-2xl py-16 md:py-24 text-center">
        <h2 className="font-display text-2xl md:text-4xl font-bold tracking-tight mb-4">
          Move ONE feature out of hooks. Just one.
        </h2>
        <p className="text-fd-muted-foreground text-lg mb-10">
          Start with one, leave the rest. See how it feels.... that's the
          whole ask.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
          <Link
            className={`${link} bg-fd-primary text-fd-primary-foreground hover:opacity-90`}
            to="/docs/getting-started">
            Let's Cook
          </Link>
          <Link
            className={`${link} border border-fd-border text-inherit hover:bg-fd-muted`}
            to="/docs">
            Peep the Docs
          </Link>
        </div>

        <div className="flex flex-col gap-2 max-w-md mx-auto text-left">
          <CopyPill label="Run this today" command="npm install @expressive/react" />
          <CopyPill label="Ask your agent if MVC is the move." command="npx skills add gabeklein/expressive-mvc" />
        </div>
        <p className="text-sm text-fd-muted-foreground mt-4">
          The skill puts your coding agent on the full API and best practices.
          Alphas don't gatekeep. #TheAIMogul
        </p>
      </div>
    </section>
  );
}
