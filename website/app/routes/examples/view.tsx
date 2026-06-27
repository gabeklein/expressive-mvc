import { lazy, Suspense } from 'react';
import { Navigate, useParams } from 'react-router';
import { examples, getFiles, NAMES } from './loader';

const Sandbox = lazy(() => import('@/components/Sandbox'));

export default function CodeSample() {
  const name = useParams()['*'];

  if (!name || !examples[name])
    return <Navigate to={`/examples/${NAMES[0]}`} replace />;

  sandbox: {
    flex: 1;
    minHeight: 0;
    position: relative;
  }

  inner: {
    absolute: fill;
    display: flex;
    flexDirection: column;
  }

  loading: {
    color: $colorFdMutedForeground;
  }

  return (
    <div _sandbox>
      <div _inner>
        <Suspense fallback={<div _loading>Loading sandbox...</div>}>
          <Sandbox name={name} files={getFiles(name)} />
        </Suspense>
      </div>
    </div>
  );
}
