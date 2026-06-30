import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { NavLink, Outlet } from 'react-router';

import { layoutOptions } from '../home';
import { GROUPS } from './loader';

export function meta() {
  return [{ title: 'Examples - Expressive' }];
}

export default function ExamplesLayout() {
  content: {
    display: flex;
    flexDirection: column;
    flex: 1;
    padding: 24;
    gap: 8;
    maxWidth: 1400;
    width: fill;
    margin: 0, auto;

    // Wide enough for a vertical sidebar beside the playground.
    $xl: {
      flexDirection: row;
      alignItems: stretch;
      gap: 24;
    }
  }

  return (
    <HomeLayout {...layoutOptions}>
      <div _content>
        <Navigation />
        <Outlet />
      </div>
    </HomeLayout>
  );
}

function Navigation() {
  display: flex;
  alignItems: center;
  gap: 8;
  overflowX: auto;
  marginLeft: 12;
  paddingBottom: 12;

  group: {
    display: flex;
    alignItems: center;
    marginR: 1.2;
    gap: 8;

    $xl: {
      flexDirection: column;
      alignItems: stretch;
      marginR: 0;
      gap: 4;
    }
  }

  // Wraps each group's links. Transparent in the horizontal bar; in the
  // sidebar it becomes the railed list (vertical guide line) the links nest in.
  items: {
    display: "contents";

    $xl: {
      display: flex;
      flexDirection: column;
      gap: 2;
      marginLeft: 10;
      borderLeft: $colorFdBorder, 1;
    }
  }

  // Stacked vertical sidebar at wide widths. align-self:flex-start stops it
  // from stretching the row to its own height; capped to the viewport and
  // scrolled internally so a short window doesn't overflow the page.
  $xl: {
    flexDirection: column;
    alignItems: stretch;
    alignSelf: "flex-start";
    overflowX: visible;
    overflowY: auto;
    minHeight: 0;
    maxHeight: "calc(100vh - 7rem)";
    position: sticky;
    top: 24;
    width: 150;
    flexShrink: 0;
    marginLeft: 0;
    paddingBottom: 0;
    gap: 20;
  }

  return (
    <nav>
      {GROUPS.map((group) => (
        <div _group key={group.slug}>
          <GroupLabel label={group.label} />
          <div _items>
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
  padding: 6, 12;
  borderRadius: 6;
  border: $colorFdBorder;
  fontSize: 0.875;
  textDecoration: none;
  color: $colorFdMutedForeground;
  userSelect: none;
  whiteSpace: nowrap;

  $hover: {
    color: $colorFdForeground;
    borderColor: $colorFdMutedForeground;
  }

  if("[aria-current='page']") {
    background: `color-mix(in srgb, var(--accent) 14%, transparent)`;
    borderColor: `color-mix(in srgb, var(--accent) 45%, transparent)`;
    color: $accent;

    // Sidebar active: left bar instead of the pill border. Media nested in
    // the selector (not the reverse) to dodge the parser bug.
    $xl: {
      borderLeftColor: $accent;
    }
  }

  // Sidebar: flush links nested on the rail, marked by a left bar instead
  // of a pill box.
  $xl: {
    border: none;
    borderLeft: transparent, 2;
    borderRadius: `0 4px 4px 0`;
    marginLeft: -1;

    $hover: {
      background: $colorFdMuted;
      borderLeftColor: $colorFdMutedForeground;
    }
  }

  return <NavLink to={`/examples/${path}`}>{label}</NavLink>;
}

function GroupLabel({ label }: { label: string }) {
  display: flex;
  alignItems: center;
  alignSelf: stretch;
  fontSize: 0.78;
  fontWeight: 600;
  textTransform: uppercase;
  letterSpacing: '0.08em';
  color: $colorFdForeground;
  whiteSpace: nowrap;
  background: $colorFdBackground;
  position: sticky;
  left: 0;
  zIndex: 1;

  fade: {
    position: absolute;
    left: "100%";
    top: 0;
    bottom: 0;
    width: 8;
    pointerEvents: none;
    background: `linear-gradient(to right, var(--color-fd-background), transparent)`;
    // media nested inside the selector, not a selector inside the media
    // block - the parser can't handle the latter (workaround).
    $xl: { display: none; }
  }

  separator: {
    width: 2;
    display: "inline-block";
    height: 2.2;
    radius: 2;
    marginLeft: 12;
    marginRight: 5;
    background: $colorFdBorder;
    $xl: { display: none; }
  }

  // In sidebar mode the row affordances (sticky pin, fade, dot) are noise;
  // the label becomes a quiet section header above a railed list.
  $xl: {
    position: "static";
    marginBottom: 6;
    paddingLeft: 8;
    fontSize: 0.72;
    color: $colorFdMutedForeground;
  }

  return (
    <span>
      {label}
      <span _separator />
      <span _fade />
    </span>
  );
}
