import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { ChevronRight, PanelLeftClose } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';

import CodeLabel from '@/components/CodeLabel';

import { layoutOptions } from '../home';
import { exampleSlug, GROUPS } from './loader';

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
    if (!navigationOpen) return;

    const close = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        window.matchMedia('(max-width: 1279px)').matches
      )
        setNavigationOpen(false);
    };

    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [navigationOpen]);

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
      <div className="relative flex min-h-0 w-full max-w-[1400px] flex-1 gap-6 p-6 mx-auto">
        <button
          aria-label="Close examples navigation"
          className={`${navigationOpen ? 'pointer-events-auto bg-black/45' : 'pointer-events-none bg-black/0'} absolute inset-6 z-40 transition-colors duration-150 ease-out motion-reduce:transition-none xl:hidden`}
          onClick={() => setNavigationOpen(false)}
          tabIndex={navigationOpen ? 0 : -1}
        />
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

// Whichever group leads the nav is the showcase, so it starts open - a visitor
// landing anywhere still has finished apps one glance away.
const LEAD = GROUPS[0]?.slug;

function Navigation({ open, onClose }: { open: boolean; onClose: () => void }) {
  const active = useActiveGroup();
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => ({
    ...(LEAD ? { [LEAD]: true } : {}),
    ...(active ? { [active]: true } : {})
  }));

  useEffect(() => {
    if (active)
      setExpanded((state) =>
        state[active] ? state : { ...state, [active]: true }
      );
  }, [active]);

  return (
    <aside
      aria-hidden={!open}
      inert={!open}
      className={`${open ? 'translate-x-0 xl:flex' : 'pointer-events-none -translate-x-[calc(100%+1.5rem)] xl:hidden'} absolute inset-y-4 left-6 z-50 flex w-64 flex-col overflow-hidden rounded-lg border border-fd-border bg-fd-background/75 p-5 shadow-2xl backdrop-blur-2xl backdrop-saturate-150 transition-transform duration-[220ms] ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform supports-[backdrop-filter:blur(0)]:bg-fd-background/45 motion-reduce:transition-none xl:static xl:z-auto xl:w-40 xl:shrink-0 xl:translate-x-0 xl:self-stretch xl:overflow-visible xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none xl:backdrop-blur-none xl:backdrop-saturate-100 xl:transition-none`}>
      <div className="mb-4 hidden items-center justify-between xl:flex">
        <span className="text-sm font-semibold">Examples</span>
        <button
          aria-label="Collapse examples navigation"
          className="flex size-8 items-center justify-center rounded-md text-fd-muted-foreground hover:bg-fd-muted hover:text-fd-foreground"
          onClick={onClose}>
          <PanelLeftClose className="size-4" />
        </button>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pb-[50vh]">
        {GROUPS.map((group) => {
          const isOpen = !!expanded[group.slug];

          return (
            <div className="flex flex-col" key={group.slug}>
              <GroupLabel
                label={group.label}
                expanded={isOpen}
                onToggle={() =>
                  setExpanded((state) => ({
                    ...state,
                    [group.slug]: !state[group.slug],
                  }))
                }
              />
              <div
                inert={!isOpen}
                className={`${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'} grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none`}>
                <div className="ml-2.5 flex min-h-0 flex-col gap-0.5 overflow-hidden border-l border-fd-border">
                  {(group.children ?? []).map((e) => (
                    <ExampleLink key={e.slug} path={e.path} label={e.label} />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function useActiveGroup() {
  const slug = exampleSlug(useLocation().pathname);

  return GROUPS.find((group) =>
    (group.children ?? []).some((child) => child.path === slug)
  )?.slug;
}

function ExampleLink({ path, label }: { path: string; label: string }) {
  return (
    <NavLink
      to={`/examples/${path}`}
      className="group -ml-px rounded-r-sm border-l-2 border-l-transparent py-1.5 px-3 text-sm no-underline text-fd-muted-foreground select-none whitespace-nowrap hover:border-l-fd-muted-foreground hover:bg-fd-muted hover:text-fd-foreground aria-[current=page]:border-l-(--accent) aria-[current=page]:bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] aria-[current=page]:text-(--accent)">
      <CodeLabel
        label={label}
        className="group-aria-[current=page]:border-transparent group-aria-[current=page]:bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] group-aria-[current=page]:text-(--accent)"
      />
    </NavLink>
  );
}

function GroupLabel({
  label,
  expanded,
  onToggle,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onToggle}
      className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-fd-muted-foreground select-none whitespace-nowrap hover:text-fd-foreground">
      <ChevronRight
        aria-hidden
        className={`${expanded ? 'rotate-90' : ''} ml-[3px] size-3.5 shrink-0 transition-transform duration-150 ease-out motion-reduce:transition-none`}
      />
      {label}
    </button>
  );
}
