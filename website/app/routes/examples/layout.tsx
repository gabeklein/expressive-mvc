import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { NavLink, Outlet } from 'react-router';

import { layoutOptions } from '../home';
import { NAMES } from './loader';

const GROUPS = NAMES.reduce((acc, slug) => {
  const [group, ...rest] = slug.split('/');
  (acc[group] ??= []).push({ slug, leaf: rest.join('/') });
  return acc;
}, {} as Record<string, { slug: string; leaf: string }[]>);

export function meta() {
  return [{ title: 'Examples - Expressive' }];
}

export default function ExamplesLayout() {
  content: {
    display: flex;
    flexDirection: column;
    flex: 1;
    padding: 12, 24, 24;
    gap: 8;
    maxWidth: 1400;
    width: fill;
    margin: 0, auto;
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
  paddingLeft: 12;
  paddingBottom: 12;

  group: {
    display: flex;
    alignItems: center;
    marginR: 1.2;
    gap: 8;
  }

  label: {
    display: flex;
    alignItems: center;
    alignSelf: stretch;
    fontSize: 0.7;
    fontWeight: 600;
    textTransform: uppercase;
    letterSpacing: '0.08em';
    color: $colorFdMutedForeground;
    whiteSpace: nowrap;
    background: $colorFdBackground;
    position: sticky;
    left: 0;
    zIndex: 1;

    $after: {
      content: "";
      position: absolute;
      left: "100%";
      top: 0;
      bottom: 0;
      width: 12;
      pointerEvents: none;
      background: `linear-gradient(to right, var(--color-fd-background), transparent 70%)`;
    }

    separator: {
      width: 2;
      display: "inline-block";
      height: 2.2;
      radius: 2;
      marginLeft: 12;
      marginRight: 5;
      background: 0xe2e2e2;
    }
  }

  NavLink: {
    padding: 6, 12;
    borderRadius: 6;
    border: $colorFdBorder;
    fontSize: 0.875;
    textDecoration: none;
    color: inherit;
    userSelect: none;
    whiteSpace: nowrap;

    $hover: {
      borderColor: $colorFdPrimary;
    }

    if("[aria-current='page']") {
      background: $colorFdPrimary;
      color: $colorFdPrimaryForeground;
      borderColor: $colorFdPrimary;
    }
  }

  return (
    <nav>
      {Object.entries(GROUPS).map(([group, items]) => (
        <div _group key={group}>
          <span _label>
            {group}
            <span _separator />
          </span>
          
          {items.map(({ slug, leaf }) => (
            <NavLink key={slug} to={`/examples/${slug}`}>
              {leaf}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}
