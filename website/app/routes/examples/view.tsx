import { lazy, Suspense } from 'react';
import { Navigate, useOutletContext, useParams } from 'react-router';
import type { ExamplesOutletContext } from './layout';
import { examples, EXAMPLE_LABELS, getFiles, REDIRECT } from './loader';

const Sandbox = lazy(() => import('@/components/Sandbox'));

export default function CodeSample() {
  const name = useParams()['*'];
  const { navigationOpen, openNavigation } =
    useOutletContext<ExamplesOutletContext>();

  if (!name || !examples[name])
    return <Navigate to={`/examples/${REDIRECT}`} replace />;

  return (
    <div className="flex-1 min-h-0 relative">
      <div className="absolute inset-0 flex flex-col">
        <Suspense
          fallback={
            <div className="text-fd-muted-foreground">Loading sandbox...</div>
          }>
          <Sandbox
            name={name}
            label={EXAMPLE_LABELS[name]}
            files={getFiles(name)}
            navigationOpen={navigationOpen}
            onOpenNavigation={openNavigation}
          />
        </Suspense>
      </div>
    </div>
  );
}
