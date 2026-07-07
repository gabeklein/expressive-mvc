import { Link } from 'react-router';
import CopyPill from '@/components/CopyPill';

export function CTA() {
  const link =
    'inline-flex items-center justify-center rounded-full font-medium py-3 px-6 no-underline transition-[opacity,background-color] duration-200';

  return (
    <section id="cta" className="panel">
      <div className="mx-auto max-w-2xl py-16 md:py-24 px-6 text-center">
        <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight mb-4">
          Move just one feature out of hooks.
        </h2>
        <p className="text-fd-muted-foreground text-lg mb-10">
          Start with one, leave the rest. See how it feels.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
          <Link
            className={`${link} bg-fd-primary text-fd-primary-foreground hover:opacity-90`}
            to="/docs/getting-started">
            Get Started
          </Link>
          <Link
            className={`${link} border border-fd-border text-inherit hover:bg-fd-muted`}
            to="/docs">
            View Docs
          </Link>
        </div>

        <div className="flex flex-col gap-2 max-w-md mx-auto text-left">
          <CopyPill label="Add to your app" command="npm install @expressive/react" />
          <CopyPill label="Ask your agent if MVC is right for you." command="npx skills add gabeklein/expressive-mvc" />
        </div>
        <p className="text-sm text-fd-muted-foreground mt-4">
          The skill hands your coding agent the full API - no guessing from stale training data.
        </p>
      </div>
    </section>
  );
}
