import { lazy, Suspense } from 'react';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { NavLink, Navigate, useParams } from 'react-router';
import { examples } from 'virtual:examples';
import { layoutOptions } from './home';

const NAMES = Object.keys(examples);
const Sandbox = lazy(() => import('@/components/Sandbox'));

export function meta() {
  return [{ title: 'Examples - Expressive' }];
}

export default function ExampleRoute() {
  const { name } = useParams();

  if (!name || !examples[name])
    return <Navigate to={`/examples/${NAMES[0]}`} replace />;

  content: {
    display: flex;
    flexDirection: column;
    flex: 1;
    padding: 24;
    gap: 16;
    maxWidth: 1400;
    width: fill;
    margin: 0, auto;
  }

  loading: {
    color: $colorFdMutedForeground;
  }

  return (
    <HomeLayout {...layoutOptions}>
      <div _content>
        <SelectExample />
        <Suspense fallback={<div _loading>Loading sandbox...</div>}>
          <Sandbox name={name} />
        </Suspense>
      </div>
    </HomeLayout>
  );
}

function SelectExample(){
    display: flex;
    flexWrap: wrap;
    gap: 8;

  NavLink: {
    padding: 6, 12;
    borderRadius: 6;
    border: $colorFdBorder;
    fontSize: 0.875;
    textDecoration: none;
    color: inherit;

    $hover: {
      borderColor: $colorFdPrimary;
    }

    $active: {
      background: $colorFdPrimary;
      color: $colorFdPrimaryForeground;
      borderColor: $colorFdPrimary;
    }
  }

  return (

        <nav>
          {NAMES.map((n) => (
            <NavLink
              key={n}
              to={`/examples/${n}`}
              className={({ isActive }) => isActive ? 'active' : ''}>
              {n}
            </NavLink>
          ))}
        </nav>
  )
}