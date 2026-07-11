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
export const mvcNpmUrl = 'https://www.npmjs.com/package/@expressive/mvc';

const fallbackStats = {
  stars: 101,
  mvcDownloads: 466,
  reactDownloads: 212,
};

function formatCount(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return new Intl.NumberFormat('en-US').format(value);
}

function useProjectStats() {
  const [stats, setStats] = useState(fallbackStats);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [repo, mvc, react] = await Promise.allSettled([
        fetch('https://api.github.com/repos/gabeklein/expressive-mvc').then((res) => res.json()),
        fetch('https://api.npmjs.org/downloads/point/last-week/@expressive/mvc').then((res) => res.json()),
        fetch('https://api.npmjs.org/downloads/point/last-week/@expressive/react').then((res) => res.json()),
      ]);

      if (cancelled) return;

      setStats({
        stars:
          repo.status === 'fulfilled' && typeof repo.value.stargazers_count === 'number'
            ? repo.value.stargazers_count
            : fallbackStats.stars,
        mvcDownloads:
          mvc.status === 'fulfilled' && typeof mvc.value.downloads === 'number'
            ? mvc.value.downloads
            : fallbackStats.mvcDownloads,
        reactDownloads:
          react.status === 'fulfilled' && typeof react.value.downloads === 'number'
            ? react.value.downloads
            : fallbackStats.reactDownloads,
      });
    }

    load().catch(() => {});

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
  const { mvcDownloads, reactDownloads } = useProjectStats();

  return (
    <span className="inline-flex items-center gap-1.5">
      <Package className="hidden size-4 sm:block" />
      <span>npm</span>
      <span className="hidden items-center gap-1 xl:inline-flex">
        <span className="rounded-full bg-fd-muted px-1.5 py-0.5 text-xs text-fd-muted-foreground">
          mvc {formatCount(mvcDownloads)}/wk
        </span>
        <span className="rounded-full bg-fd-muted px-1.5 py-0.5 text-xs text-fd-muted-foreground">
          react {formatCount(reactDownloads)}/wk
        </span>
      </span>
    </span>
  );
}

export function DiscordLinkLabel() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <MessageCircle className="hidden size-4 sm:block" />
      <span>Discord</span>
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

export const projectLinks: LinkItemType[] = [
  { text: 'Docs', url: '/docs', active: 'nested-url' },
  { text: 'Playground', url: '/examples', active: 'nested-url' },
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
