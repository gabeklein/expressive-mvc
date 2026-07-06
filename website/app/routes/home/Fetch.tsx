import Compare from '@/components/Compare';
import Playground from '@/components/Playground';
import code from '@/components/Snippet';

export function Fetch() {
  return (
    <section className="bg-fd-foreground/[0.04]">
      <div className="mx-auto max-w-(--content-width) px-6 py-24">
        <div className="max-w-2xl mb-12">
          <div className="text-xs uppercase tracking-widest text-fd-muted-foreground mb-3">
            Async
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Async out of the box.
          </h2>
          <p className="text-fd-muted-foreground text-lg">
            An async <code className={mono}>set()</code> suspends render until
            it resolves. A <code className={mono}>Component</code> brings its
            own <code className={mono}>fallback</code> and its own error
            boundary via <code className={mono}>catch()</code> - no{' '}
            <code className={mono}>isPending</code> flags, client to provide,
            or cache keys.
          </p>
        </div>

        <Compare
          left={{ label: 'set(async)', code: ExprCode }}
          right={[
            { label: 'React Query', code: QueryCode },
            { label: 'SWR', code: SwrCode },
          ]}
        />

        <Playground to="/examples/essentials/async" />

        <p className="text-fd-muted-foreground text-lg leading-relaxed max-w-3xl mx-auto mt-10 text-center">
          That <code className={mono}>set()</code> is an{' '}
          <em>instruction</em> - property helpers that give a field special
          behavior. There are a handful: <code className={mono}>get()</code>{' '}
          pulls from context, <code className={mono}>ref()</code> tracks DOM
          nodes, and you can define your own.
        </p>
      </div>
    </section>
  );
}

const mono = 'font-mono text-sm bg-fd-muted px-1.5 py-0.5 rounded';

const ExprCode = code /*tsx*/`
  import React from 'react';
  import { Component, set } from '@expressive/react';

  class Profile extends Component {
    fallback = <p>Loading...</p>;

    user = set(async () => {
      const res = await fetch('/api/user/1');

      if (!res.ok)
        throw new Error('Something broke');

      return res.json();
    });

    async catch(error: Error) {
      this.fallback = <p>{error.message}</p>;
    }

    render() {
      return <h1>Hello {this.user.name}</h1>;
    }
  }

  const App = () => <Profile />;
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
