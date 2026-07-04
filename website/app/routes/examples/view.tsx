import { lazy, Suspense } from 'react';
import { Navigate, useParams } from 'react-router';
import { examples, getFiles, REDIRECT } from './loader';

const Sandbox = lazy(() => import('@/components/Sandbox'));

export default function CodeSample() {
  const name = useParams()['*'];

  if (!name || !examples[name])
    return <Navigate to={`/examples/${REDIRECT}`} replace />;

  return (
    <div className="flex-1 min-h-0 relative">
      <div className="absolute inset-0 flex flex-col">
        <Suspense
          fallback={
            <div className="text-fd-muted-foreground">Loading sandbox...</div>
          }>
          <Sandbox name={name} files={getFiles(name)} />
        </Suspense>
      </div>
    </div>
  );
}
