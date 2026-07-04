import { Link } from 'react-router';

export function CTA() {
  const link =
    'inline-flex items-center justify-center rounded-full font-medium py-3 px-6 no-underline transition-[opacity,background-color] duration-200';

  return (
    <section>
      <div className="mx-auto max-w-3xl py-24 px-6 text-center">
        <h2 className="text-[1.875em] md:text-[2.25em] font-bold mb-4">
          Ready to move state out of components?
        </h2>
        <p className="text-fd-muted-foreground text-[1.125em] mb-10">
          Start with one feature. Leave everything else alone. See how it feels.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            className={`${link} bg-fd-primary text-fd-primary-foreground hover:opacity-90`}
            to="/docs/getting-started">
            Getting Started
          </Link>
          <Link
            className={`${link} border border-fd-border text-inherit hover:bg-fd-muted`}
            to="/docs/migrating-from-hooks">
            Migration Guide
          </Link>
          <Link
            className={`${link} border border-fd-border text-inherit hover:bg-fd-muted`}
            to="/docs/comparisons">
            Compare
          </Link>
        </div>
      </div>
    </section>
  );
}
