import {
  ClassGreeting,
  ContextFrame,
  ContextGreeting,
  ContextValue,
  Counter,
  StreamedCounter
} from './sanity';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

async function ServerSlot({ count }: { count: number }) {
  await Promise.resolve();

  return (
    <section>
      <p>Server slot: {count}</p>
      <ContextValue />
    </section>
  );
}

export default async function Page({
  searchParams
}: {
  searchParams: Promise<{ initial?: string }>;
}) {
  const { initial } = await searchParams;
  const count = Number(initial ?? 3);
  const streamed = new Promise<{ count: number; message: string }>((resolve) => {
    setTimeout(() => resolve({
      count,
      message: `Streamed request ${count}`
    }), 10);
  });

  return (
    <main>
      <h1>Expressive MVC Next.js sanity</h1>
      <Counter initial={count} />
      <ContextGreeting message="Hello from context" />
      <ContextFrame message={`Request ${count}`}>
        <ServerSlot count={count} />
      </ContextFrame>
      <Suspense fallback={<p>Loading streamed state</p>}>
        <StreamedCounter state={streamed} />
      </Suspense>
      <ClassGreeting name="Next.js" />
    </main>
  );
}
