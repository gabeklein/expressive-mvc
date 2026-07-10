'use client';

import type { LinkItemType } from 'fumadocs-ui/layouts/shared';
import { useSearchContext } from 'fumadocs-ui/contexts/search';
import { ExternalLink, Github, MessageCircle, Moon, Package, Search, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

export const githubUrl = 'https://github.com/gabeklein/expressive-mvc';
export const discordUrl = 'https://discord.gg/EBWC7HyTBd';
export const reactNpmUrl = 'https://www.npmjs.com/package/@expressive/react';

const fallbackStats = {
  stars: 101,
  reactDownloads: 212,
  discordMembers: 4,
};

let statsRequest: Promise<typeof fallbackStats> | undefined;

function formatCount(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return new Intl.NumberFormat('en-US').format(value);
}

function useProjectStats() {
  const [stats, setStats] = useState(fallbackStats);

  useEffect(() => {
    let cancelled = false;

    statsRequest ??= Promise.allSettled([
      fetch('https://api.github.com/repos/gabeklein/expressive-mvc').then((res) => res.json()),
      fetch('https://api.npmjs.org/downloads/point/last-week/@expressive/react').then((res) => res.json()),
      fetch('/api/discord-stats').then((res) => res.json()),
    ]).then(([repo, react, discord]) => {
      return {
        stars:
          repo.status === 'fulfilled' && typeof repo.value.stargazers_count === 'number'
            ? repo.value.stargazers_count
            : fallbackStats.stars,
        reactDownloads:
          react.status === 'fulfilled' && typeof react.value.downloads === 'number'
            ? react.value.downloads
            : fallbackStats.reactDownloads,
        discordMembers:
          discord.status === 'fulfilled' && typeof discord.value.members === 'number'
            ? discord.value.members
            : fallbackStats.discordMembers,
      };
    });

    statsRequest.then((next) => {
      if (!cancelled) setStats(next);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return stats;
}

export function GitHubStars() {
  const { stars } = useProjectStats();

  return (
    <span className="inline-flex items-center gap-1.5">
      <Github className="hidden size-4 sm:block" />
      <span>GitHub</span>
      <span className="hidden items-center rounded-full bg-fd-muted px-1.5 py-0.5 text-xs text-fd-muted-foreground sm:inline-flex">
        {formatCount(stars)}
      </span>
    </span>
  );
}

export function NpmBadges() {
  const { reactDownloads } = useProjectStats();

  return (
    <span className="inline-flex items-center gap-1.5">
      <Package className="hidden size-4 sm:block" />
      <span>npm</span>
      <span className="hidden rounded-full bg-fd-muted px-1.5 py-0.5 text-xs text-fd-muted-foreground xl:inline-flex">
        {formatCount(reactDownloads)}/wk
      </span>
    </span>
  );
}

export function DiscordLinkLabel() {
  const { discordMembers } = useProjectStats();

  return (
    <span className="inline-flex items-center gap-1.5">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="hidden size-4 sm:block">
        <path d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.51 13.8 13.8 0 0 0-.63 1.28 18.3 18.3 0 0 0-5.58 0 12.6 12.6 0 0 0-.64-1.28 20 20 0 0 0-4.9 1.52C.58 9.05-.26 13.61.16 18.1a19.9 19.9 0 0 0 6 3.03 14.7 14.7 0 0 0 1.29-2.1 12.9 12.9 0 0 1-2.03-.98l.5-.39a14.2 14.2 0 0 0 12.17 0l.51.39c-.65.39-1.33.72-2.03.98.37.73.8 1.43 1.29 2.1a19.9 19.9 0 0 0 6-3.03c.5-5.2-.85-9.72-3.54-13.73ZM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42Zm7.97 0c-1.19 0-2.16-1.08-2.16-2.42 0-1.33.95-2.42 2.16-2.42 1.21 0 2.17 1.1 2.15 2.42 0 1.34-.94 2.42-2.15 2.42Z" />
      </svg>
      <span>Discord</span>
      <span className="hidden rounded-full bg-fd-muted px-1.5 py-0.5 text-xs text-fd-muted-foreground xl:inline-flex">
        {formatCount(discordMembers)}
      </span>
    </span>
  );
}

export function ExternalLinkLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{children}</span>
      <ExternalLink className="size-3.5" />
    </span>
  );
}

export function MobileHeaderActions({ docs = true }: { docs?: boolean }) {
  if (!docs) return <div className="ms-auto sm:hidden" />;

  return (
    <div className="ms-2 me-auto flex items-center gap-1 sm:hidden">
      <Link
        to="/docs"
        className="rounded-full px-2.5 py-1 text-xs font-medium text-fd-muted-foreground no-underline transition-colors hover:bg-fd-muted hover:text-fd-foreground">
        Docs
      </Link>
    </div>
  );
}

export function MobileSearchActions() {
  const { enabled, setOpenSearch } = useSearchContext();
  const { resolvedTheme, setTheme } = useTheme();
  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';

  return (
    <div className="flex items-center gap-1 sm:hidden">
      {enabled && (
        <button
          type="button"
          aria-label="Open Search"
          data-search=""
          onClick={() => setOpenSearch(true)}
          className="inline-flex size-8 items-center justify-center rounded-full text-fd-muted-foreground transition-colors hover:bg-fd-muted hover:text-fd-foreground">
          <Search className="size-4" />
        </button>
      )}
      <button
        type="button"
        aria-label="Toggle theme"
        onClick={() => setTheme(nextTheme)}
        className="inline-flex size-8 items-center justify-center rounded-full text-fd-muted-foreground transition-colors hover:bg-fd-muted hover:text-fd-foreground">
        <Sun className="size-4 dark:hidden" />
        <Moon className="hidden size-4 dark:block" />
      </button>
    </div>
  );
}

export function DocsSocialLinks() {
  const links = [
    { label: <DiscordLinkLabel />, url: discordUrl },
    { label: <GitHubStars />, url: githubUrl },
    { label: <NpmBadges />, url: reactNpmUrl },
  ];

  return (
    <nav className="grid gap-0.5 pt-2">
      {links.map(({ label, url }) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center rounded-lg p-2 text-fd-muted-foreground no-underline transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground/80">
          {label}
        </a>
      ))}
    </nav>
  );
}

export const docsLinks: LinkItemType[] = [
  { text: 'Docs', url: '/docs', active: 'nested-url' },
  { text: 'Playground', url: '/examples', active: 'nested-url' },
];

export const projectLinks: LinkItemType[] = [
  ...docsLinks,
  {
    type: 'button',
    text: <DiscordLinkLabel />,
    url: discordUrl,
    external: true,
    secondary: true,
  },
  {
    type: 'button',
    text: <GitHubStars />,
    url: githubUrl,
    external: true,
    secondary: true,
  },
  {
    type: 'button',
    text: <NpmBadges />,
    url: reactNpmUrl,
    external: true,
    secondary: true,
  },
];
