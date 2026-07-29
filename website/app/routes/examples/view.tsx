import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, useOutletContext, useParams } from 'react-router';

import CodeLabel from '@/components/CodeLabel';

import type { ExamplesOutletContext } from './layout';
import { examples, EXAMPLE_LABELS, getFiles, REDIRECT } from './loader';

const Sandbox = lazy(() => import('@/components/Sandbox'));

export function meta({ params }: { params: { '*'?: string } }) {
  const label = params['*'] && EXAMPLE_LABELS[params['*']]?.replace(/`/g, '');

  if (!label)
    return [
      { title: 'Examples - Expressive MVC' },
      {
        name: 'description',
        content:
          'Interactive examples of class-based reactive state with Expressive MVC - editable and runnable in the browser.',
      },
    ];

  return [
    { title: `${label} Example - Expressive MVC` },
    {
      name: 'description',
      content: `${label} built with Expressive MVC - class-based reactive state for React, editable and runnable in the browser.`,
    },
  ];
}

function SourceListing({ name }: { name: string }) {
  const label = EXAMPLE_LABELS[name].replace(/`/g, '');
  const files = Object.entries(examples[name])
    .filter(([path]) => path !== '/index.tsx')
    .sort(([a], [b]) =>
      a === '/App.tsx' ? -1 : b === '/App.tsx' ? 1 : a.localeCompare(b)
    );

  return (
    <article className="min-h-0 flex-1 overflow-y-auto">
      <h1 className="text-2xl font-semibold">
        <CodeLabel label={EXAMPLE_LABELS[name]} />
      </h1>
      <p className="mt-2 text-fd-muted-foreground">
        {label} demo built with Expressive MVC - the complete source below
        runs as an editable sandbox when JavaScript is enabled.
      </p>
      {files.map(([path, code]) => (
        <section key={path} className="mt-6">
          <h2 className="font-mono text-sm font-medium">{path.slice(1)}</h2>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-fd-border p-4 text-sm">
            <code>{code}</code>
          </pre>
        </section>
      ))}
    </article>
  );
}

export default function CodeSample() {
  const name = useParams()['*'];
  const { navigationOpen, openNavigation } =
    useOutletContext<ExamplesOutletContext>();
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  if (!name || !examples[name])
    return <Navigate to={`/examples/${REDIRECT}`} replace />;

  const listing = <SourceListing name={name} />;

  return (
    <div className="flex-1 min-h-0 relative">
      <div className="absolute inset-0 flex flex-col">
        {ready ? (
          <Suspense fallback={listing}>
            <Sandbox
              name={name}
              label={EXAMPLE_LABELS[name]}
              files={getFiles(name)}
              navigationOpen={navigationOpen}
              onOpenNavigation={openNavigation}
            />
          </Suspense>
        ) : (
          listing
        )}
      </div>
    </div>
  );
}
