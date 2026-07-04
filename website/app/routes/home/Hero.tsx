import { Link } from 'react-router';

export function Hero() {
  return (
    <section className="border-b border-fd-border box-border h-[calc(100vh-56px)] flex items-center justify-center">
      <div className="mx-auto max-w-5xl py-24 px-6 text-center md:py-32">
        <div className="inline-block mb-6 text-xs uppercase tracking-widest text-fd-muted-foreground">
          State management, reorganized
        </div>
        <h1 className="text-5xl font-display max-w-[10em] mx-auto font-bold tracking-tight leading-tight mb-6 md:text-7xl">
          What if state had it's own Component?
        </h1>
        <p className="text-lg text-fd-muted-foreground max-w-2xl mx-auto mb-10 md:text-xl">
          Expressive MVC consolidates your application state into plain classes.
          No reducers, no selectors, no dependency arrays. Just data, behavior,
          and lifecycle in one place.
        </p>
        <HeroNavigation />
        <div className="mt-12 inline-block font-mono text-sm bg-fd-muted py-3 px-5 rounded-lg text-fd-muted-foreground">
          npm install @expressive/react
        </div>
      </div>
    </section>
  );
}

const linkClass =
  'inline-flex items-center justify-center rounded-full font-medium py-3 px-6 no-underline transition-[opacity,background-color] duration-200';

function HeroNavigation() {
  return (
    <div className="flex flex-col gap-3 justify-center sm:flex-row">
      <Link
        className={`${linkClass} bg-fd-primary text-fd-primary-foreground hover:opacity-90`}
        to="/docs/getting-started">
        Get Started
      </Link>
      <Link
        className={`${linkClass} border border-fd-border text-inherit hover:bg-fd-muted`}
        to="/docs/why-classes">
        Why Classes?
      </Link>
    </div>
  );
}
