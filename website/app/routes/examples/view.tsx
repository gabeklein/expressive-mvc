import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, useOutletContext, useParams } from 'react-router';
import type { ExamplesOutletContext } from './layout';
import { examples, EXAMPLE_LABELS, getFiles, REDIRECT } from './loader';

const Sandbox = lazy(() => import('@/components/Sandbox'));

export function meta({ params }: { params: { '*'?: string } }) {
  const label = params['*'] && EXAMPLE_LABELS[params['*']];

  if (!label)
    return [
      { title: 'Examples - Expressive' },
      {
        name: 'description',
        content:
          'Interactive examples of class-based reactive state with Expressive MVC - editable and runnable in the browser.',
      },
    ];

  return [
    { title: `${label} Example - Expressive` },
    {
      name: 'description',
      content: `${label} built with Expressive MVC - class-based reactive state for React, editable and runnable in the browser.`,
    },
  ];
}

export default function CodeSample() {
  const name = useParams()['*'];
  const { navigationOpen, openNavigation } =
    useOutletContext<ExamplesOutletContext>();
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  if (!name || !examples[name])
    return <Navigate to={`/examples/${REDIRECT}`} replace />;

  const placeholder = (
    <div className="text-fd-muted-foreground">Loading sandbox...</div>
  );

  return (
    <div className="flex-1 min-h-0 relative">
      <div className="absolute inset-0 flex flex-col">
        {ready ? (
          <Suspense fallback={placeholder}>
            <Sandbox
              name={name}
              label={EXAMPLE_LABELS[name]}
              files={getFiles(name)}
              navigationOpen={navigationOpen}
              onOpenNavigation={openNavigation}
            />
          </Suspense>
        ) : (
          placeholder
        )}
      </div>
    </div>
  );
}
