import type React from 'react';
import Section from '@/components/Section';
import code from '@/components/Snippet';

export function Problem() {
  return (
    <Section>
      <Header
        label="The problem"
        title="Hooks split state from the logic that owns it.">
        A single async request needs three pieces of state to track its phases,
        plus a memoized callback to keep them in sync. Each one is its own hook,
        its own dependency, its own way to fall out of sync.
      </Header>
      <HooksExample />
      <p className="text-fd-muted-foreground mt-6 text-center italic">
        Three{' '}
        <code className="text-[0.875em] bg-fd-muted py-0.5 px-1.5 rounded">
          useState
        </code>{' '}
        and a{' '}
        <code className="text-[0.875em] bg-fd-muted py-0.5 px-1.5 rounded">
          useCallback
        </code>{' '}
        to coordinate one request.
      </p>
    </Section>
  );
}

export function Solution() {
  return (
    <Section tint>
      <Header accent label="The solution" title="A class keeps them together.">
        Fields hold state. Methods mutate them directly. The component reads
        what it needs, and renders only when those values change. Same flow, no
        orchestration. Components go back to being stateless.
      </Header>
      <ClassExample />
      <p className="text-fd-muted-foreground mt-6 text-center italic">
        Reactive fields. Plain methods. The component just reads.
      </p>
    </Section>
  );
}

function Header({
  label,
  title,
  accent,
  children,
}: {
  label: string;
  title: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={accent ? 'max-w-[800px] mb-12' : 'max-w-2xl mb-12'}>
      <div
        className={`text-[0.75em] uppercase tracking-widest mb-3 ${accent ? 'text-fd-primary' : 'text-fd-muted-foreground'}`}>
        {label}
      </div>
      <h2 className="text-[1.875em] md:text-[2.25em] font-bold mb-4">
        {title}
      </h2>
      <p className="text-fd-muted-foreground text-[1.125em]">{children}</p>
    </div>
  );
}

const HooksExample = code /*tsx*/`
  import { getUser } from './api';

  function App() {
    const [response, setResponse] = useState(null);
    const [error, setError] = useState(null);
    const [waiting, setWaiting] = useState(false);

    const run = useCallback(async () => {
      setWaiting(true);
      setError(null);
      try {
        const { name } = await getUser();
        setResponse('Hello ' + name);
      } catch (e) {
        if (e instanceof Error) setError(e);
      } finally {
        setWaiting(false);
      }
    }, []);

    if (response) return <p>Server said: {response}</p>;
    if (error) return <p>Error: {error.message}</p>;
    if (waiting) return <p>Waiting...</p>;

    return <button onClick={run}>Say hello</button>;
  }
`;

const ClassExample = code /*tsx*/`
  import State from '@expressive/react';
  import { getUser } from './api';

  class Query extends State {
    response?: string = undefined;
    error?: Error = undefined;
    waiting = false;

    async run() {
      this.waiting = true;
      try {
        const { name } = await getUser();
        this.response = 'Hello ' + name;
      } catch (e) {
        if (e instanceof Error) this.error = e;
      } finally {
        this.waiting = false;
      }
    }
  }

  const App = () => {
    const { error, response, waiting, run } = Query.use();

    if (response) return <p>Server said: {response}</p>;
    if (error) return <p>Error: {error.message}</p>;
    if (waiting) return <p>Waiting...</p>;

    return <button onClick={run}>Say hello</button>;
  };
`;
