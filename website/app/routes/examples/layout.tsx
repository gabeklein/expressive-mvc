import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { NavLink, Outlet } from 'react-router';

import { layoutOptions } from '../home';
import { GROUPS } from './loader';

export function meta() {
  return [{ title: 'Examples - Expressive' }];
}

export default function ExamplesLayout() {
  return (
    <HomeLayout {...layoutOptions}>
      <div className="flex flex-col flex-1 p-6 gap-2 max-w-[1400px] w-full mx-auto xl:flex-row xl:items-stretch xl:gap-6">
        <Navigation />
        <Outlet />
      </div>
    </HomeLayout>
  );
}

function Navigation() {
  return (
    <nav className="flex items-center gap-2 overflow-x-auto ml-3 pb-3 xl:flex-col xl:items-stretch xl:self-start xl:overflow-x-visible xl:overflow-y-auto xl:min-h-0 xl:max-h-[calc(100vh-7rem)] xl:sticky xl:top-6 xl:w-[150px] xl:shrink-0 xl:ml-0 xl:pb-0 xl:gap-5">
      {GROUPS.map((group) => (
        <div
          className="flex items-center mr-[1.2em] gap-2 xl:flex-col xl:items-stretch xl:mr-0 xl:gap-1"
          key={group.slug}>
          <GroupLabel label={group.label} />
          <div className="contents xl:flex xl:flex-col xl:gap-[2px] xl:ml-2.5 xl:border-l xl:border-fd-border">
            {(group.children ?? []).map((e) => (
              <ExampleLink key={e.slug} path={e.path} label={e.label} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function ExampleLink({ path, label }: { path: string; label: string }) {
  return (
    <NavLink
      to={`/examples/${path}`}
      className="py-1.5 px-3 rounded-md border border-fd-border text-[0.875em] no-underline text-fd-muted-foreground select-none whitespace-nowrap hover:text-fd-foreground hover:border-fd-muted-foreground aria-[current=page]:bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] aria-[current=page]:border-[color-mix(in_srgb,var(--accent)_45%,transparent)] aria-[current=page]:text-(--accent) xl:border-0 xl:border-l-2 xl:border-l-transparent xl:rounded-l-none xl:rounded-r-sm xl:-ml-px xl:hover:bg-fd-muted xl:hover:border-l-fd-muted-foreground xl:aria-[current=page]:border-l-(--accent)">
      {label}
    </NavLink>
  );
}

function GroupLabel({ label }: { label: string }) {
  return (
    <span className="flex items-center self-stretch text-[0.78em] font-semibold uppercase tracking-[0.08em] text-fd-foreground whitespace-nowrap bg-fd-background sticky left-0 z-[1] xl:static xl:mb-1.5 xl:pl-2 xl:text-[0.72em] xl:text-fd-muted-foreground">
      {label}
      <span className="w-[2px] inline-block h-[2.2em] rounded-xs ml-3 mr-[5px] bg-fd-border xl:hidden" />
      <span className="absolute left-full top-0 bottom-0 w-2 pointer-events-none bg-[linear-gradient(to_right,var(--color-fd-background),transparent)] xl:hidden" />
    </span>
  );
}
