import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { PanelLeftClose, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router';

import { layoutOptions } from '../home';
import { GROUPS } from './loader';

export function meta() {
  return [{ title: 'Examples - Expressive' }];
}

export interface ExamplesOutletContext {
  navigationOpen: boolean;
  openNavigation: () => void;
}

export default function ExamplesLayout() {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [viewport, setViewport] = useState({ height: '100dvh', offset: 0 });

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1280px)');
    const update = () => setNavigationOpen(media.matches);

    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const visual = window.visualViewport;
    if (!visual) return;

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setViewport({
          height: `${Math.round(visual.height)}px`,
          offset: Math.round(visual.offsetTop),
        });
      });
    };

    update();
    visual.addEventListener('resize', update);
    visual.addEventListener('scroll', update);
    return () => {
      cancelAnimationFrame(frame);
      visual.removeEventListener('resize', update);
      visual.removeEventListener('scroll', update);
    };
  }, []);

  useEffect(() => {
    const rootOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    const bodyMinHeight = document.body.style.minHeight;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.minHeight = '0';

    return () => {
      document.documentElement.style.overflow = rootOverflow;
      document.body.style.overflow = bodyOverflow;
      document.body.style.minHeight = bodyMinHeight;
    };
  }, []);

  return (
    <HomeLayout
      {...layoutOptions}
      className="fixed inset-x-0 top-0 min-h-0 overflow-hidden"
      style={{
        height: viewport.height,
        transform: `translateY(${viewport.offset}px)`,
      }}>
      <div className="flex flex-1 min-h-0 p-6 gap-6 max-w-[1400px] w-full mx-auto">
        {navigationOpen && (
          <button
            aria-label="Close examples navigation"
            className="fixed inset-0 z-40 bg-black/35 xl:hidden"
            onClick={() => setNavigationOpen(false)}
          />
        )}
        <Navigation
          open={navigationOpen}
          onClose={() => setNavigationOpen(false)}
        />
        <Outlet
          context={{
            navigationOpen,
            openNavigation: () => setNavigationOpen(true),
          } satisfies ExamplesOutletContext}
        />
      </div>
    </HomeLayout>
  );
}

function Navigation({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <aside
      className={`${open ? 'flex' : 'hidden'} fixed inset-y-0 left-0 z-50 w-64 flex-col bg-fd-background p-5 shadow-2xl xl:static xl:z-auto xl:w-40 xl:shrink-0 xl:self-stretch xl:bg-transparent xl:p-0 xl:shadow-none`}>
      <div className="mb-5 flex items-center justify-between xl:mb-4">
        <span className="text-sm font-semibold">Examples</span>
        <button
          aria-label="Collapse examples navigation"
          className="flex size-8 items-center justify-center rounded-md text-fd-muted-foreground hover:bg-fd-muted hover:text-fd-foreground"
          onClick={onClose}>
          <PanelLeftClose className="hidden size-4 xl:block" />
          <X className="size-4 xl:hidden" />
        </button>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
        {GROUPS.map((group) => (
          <div className="flex flex-col gap-1" key={group.slug}>
            <GroupLabel label={group.label} />
            <div className="ml-2.5 flex flex-col gap-0.5 border-l border-fd-border">
              {(group.children ?? []).map((e) => (
                <ExampleLink
                  key={e.slug}
                  path={e.path}
                  label={e.label}
                  onNavigate={() => {
                    if (window.matchMedia('(max-width: 1279px)').matches)
                      onClose();
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

function ExampleLink({
  path,
  label,
  onNavigate,
}: {
  path: string;
  label: string;
  onNavigate: () => void;
}) {
  return (
    <NavLink
      to={`/examples/${path}`}
      onClick={onNavigate}
      className="-ml-px rounded-r-sm border-l-2 border-l-transparent py-1.5 px-3 text-sm no-underline text-fd-muted-foreground select-none whitespace-nowrap hover:border-l-fd-muted-foreground hover:bg-fd-muted hover:text-fd-foreground aria-[current=page]:border-l-(--accent) aria-[current=page]:bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] aria-[current=page]:text-(--accent)">
      {label}
    </NavLink>
  );
}

function GroupLabel({ label }: { label: string }) {
  return (
    <span className="mb-1.5 pl-2 text-xs font-semibold uppercase tracking-widest text-fd-muted-foreground whitespace-nowrap">
      {label}
    </span>
  );
}
