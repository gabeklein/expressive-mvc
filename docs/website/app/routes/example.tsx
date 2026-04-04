import { lazy, Suspense } from 'react';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { NavLink, Navigate, useParams } from 'react-router';
import { examples } from 'virtual:examples';
import { layoutOptions } from './docs';

const NAMES = Object.keys(examples);
const Sandbox = lazy(() => import('@/components/sandbox'));

export function meta() {
  return [{ title: 'Examples - Expressive' }];
}

export default function ExampleRoute() {
  const { name } = useParams<{ name: string }>();

  if (!name || !examples[name])
    return <Navigate to={`/examples/${NAMES[0]}`} replace />;

  return (
    <HomeLayout {...layoutOptions}>
      <div className="flex flex-col flex-1 p-6 gap-4 max-w-[1400px] w-full mx-auto">
        <nav className="flex flex-wrap gap-2">
          {NAMES.map((n) => (
            <NavLink
              key={n}
              to={`/examples/${n}`}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md border text-sm ${
                  isActive
                    ? 'bg-fd-primary text-fd-primary-foreground border-fd-primary'
                    : 'border-fd-border hover:border-fd-primary'
                }`
              }>
              {n}
            </NavLink>
          ))}
        </nav>
        <div className="flex flex-col h-[calc(100vh-12rem)]">
          <Suspense
            fallback={
              <div className="text-fd-muted-foreground">Loading sandbox...</div>
            }>
            <Sandbox name={name} />
          </Suspense>
        </div>
      </div>
    </HomeLayout>
  );
}
