import { Link } from 'react-router';
import Compare from '@/components/Compare';
import code from '@/components/Snippet';

export function Fetch() {
  return (
    <section>
      <div className="mx-auto max-w-(--content-width) px-6 py-24">
        <div className="max-w-2xl mb-12">
          <div className="text-xs uppercase tracking-widest text-fd-muted-foreground mb-3">
            Async
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Fetch without a query library.
          </h2>
          <p className="text-fd-muted-foreground text-lg">
            An async <code className={mono}>set()</code> suspends readers until
            it resolves. Suspense shows the fallback, an error boundary catches
            the failure - no <code className={mono}>isPending</code> flags, no
            client to provide, no cache keys.
          </p>
        </div>

        <Compare
          left={{ label: 'set(async)', code: ExprCode }}
          right={[
            { label: 'React Query', code: QueryCode },
            { label: 'SWR', code: SwrCode },
          ]}
        />

        <div className="mt-8 text-center">
          <Link
            className="text-fd-primary font-medium no-underline hover:opacity-80"
            to="/examples/essentials/fetch">
            See a fuller pattern in the Playground →
          </Link>
        </div>
      </div>
    </section>
  );
}

const mono = 'font-mono text-sm bg-fd-muted px-1.5 py-0.5 rounded';

const ExprCode = code /*tsx*/`
  import React, { Suspense } from 'react';
  import State, { set } from '@expressive/react';

  class User extends State {
    data = set(async () => {
      const res = await fetch('/api/user/1');
      return res.json();
    });
  }

  function Profile() {
    const { data } = User.use();

    return <h1>Hello {data.name}</h1>;
  }

  function App() {
    return (
      <Suspense fallback={<p>Loading...</p>}>
        <Profile />
      </Suspense>
    );
  }
`;

const QueryCode = code /*tsx*/`
  import React, { useState } from 'react';
  import {
    QueryClient,
    QueryClientProvider,
    useQuery,
  } from '@tanstack/react-query';

  function Profile() {
    const { data, isPending, error } = useQuery({
      queryKey: ['user', 1],
      queryFn: () =>
        fetch('/api/user/1').then(res => res.json()),
    });

    if (isPending) return <p>Loading...</p>;
    if (error) return <p>Something broke</p>;

    return <h1>Hello {data.name}</h1>;
  }

  function App() {
    const [client] = useState(() => new QueryClient());

    return (
      <QueryClientProvider client={client}>
        <Profile />
      </QueryClientProvider>
    );
  }
`;

const SwrCode = code /*tsx*/`
  import React from 'react';
  import useSWR from 'swr';

  function Profile() {
    const { data, error, isLoading } = useSWR(
      '/api/user/1',
      url => fetch(url).then(res => res.json()),
    );

    if (isLoading) return <p>Loading...</p>;
    if (error) return <p>Something broke</p>;

    return <h1>Hello {data.name}</h1>;
  }

  function App() {
    return <Profile />;
  }
`;
