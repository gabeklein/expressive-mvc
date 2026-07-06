import { Link } from 'react-router';

const link = 'text-fd-muted-foreground no-underline hover:text-fd-foreground transition-colors';

export function Footer() {
  return (
    <footer className="border-t border-fd-border mt-auto">
      <div className="mx-auto max-w-(--content-width) px-6 py-10 flex flex-wrap items-center justify-between gap-4 text-sm">
        <span className="text-fd-muted-foreground">
          Expressive MVC · MIT License
        </span>
        <nav className="flex flex-wrap items-center gap-6">
          <Link className={link} to="/docs">
            Docs
          </Link>
          <Link className={link} to="/examples">
            Playground
          </Link>
          <a className={link} href="https://github.com/gabeklein/expressive-mvc">
            GitHub
          </a>
          <a className={link} href="https://www.npmjs.com/package/@expressive/react">
            npm
          </a>
        </nav>
      </div>
    </footer>
  );
}
