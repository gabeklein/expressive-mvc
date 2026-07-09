import { Link } from 'react-router';
import { Icon } from '@/components/Logo';
import {
  DiscordLinkLabel,
  GitHubStars,
  NpmBadges,
  discordUrl,
  githubUrl,
  reactNpmUrl,
} from '@/components/ProjectLinks';

const link = 'text-fd-muted-foreground no-underline hover:text-fd-foreground transition-colors';

export function Footer() {
  return (
    <footer className="border-t border-fd-border mt-auto">
      <div className="mx-auto max-w-(--content-width) px-6 py-10 flex flex-col items-center gap-6 text-sm text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-2.5 text-fd-muted-foreground">
          <Icon className="size-6 text-logo" />
          <span>Expressive MVC · MIT © 2026 Gabe Klein</span>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <Link className={link} to="/docs">
            Docs
          </Link>
          <Link className={link} to="/examples">
            Playground
          </Link>
          <a className={link} href={githubUrl}>
            <GitHubStars />
          </a>
          <a className={link} href={discordUrl}>
            <DiscordLinkLabel />
          </a>
          <a className={link} href={reactNpmUrl}>
            <NpmBadges />
          </a>
        </nav>
      </div>
    </footer>
  );
}
