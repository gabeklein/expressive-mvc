import React from 'react';

import code from '@/components/Snippet';
import Section from '@/components/Section';

export function Problem() {
  code: {
    fontSize: 0.875;
    background: $colorFdMuted;
    padding: 2, 6;
    borderRadius: 4;
  }

  caption: {
    color: $colorFdMutedForeground;
    marginTop: 24;
    textAlign: center;
    fontStyle: italic;
  }

  return (
    <Section>
      <Header label="The problem" title="Hooks split state from the logic that owns it.">
        A single async request needs three pieces of state to track its
        phases, plus a memoized callback to keep them in sync. Each one is
        its own hook, its own dependency, its own way to fall out of sync.
      </Header>
      <HooksExample />
      <p _caption>
        Three <code>useState</code> and a <code>useCallback</code> to coordinate one request.
      </p>
    </Section>
  );
}

export function Solution() {
  caption: {
    color: $colorFdMutedForeground;
    marginTop: 24;
    textAlign: center;
    fontStyle: italic;
  }

  return (
    <Section tint>
      <Header accent label="The solution" title="A class keeps them together.">
        Fields hold state. Methods mutate them directly. The component reads
        what it needs, and renders only when those values change. Same
        flow, no orchestration. Components go back to being stateless.
      </Header>
      <ClassExample />
      <p _caption>
        Reactive fields. Plain methods. The component just reads.
      </p>
    </Section>
  );
}

function Header({ label, title, accent, children }: {
  label: string;
  title: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  maxWidth: 672;
  marginBottom: 48;
  if (accent) { maxWidth: 800; }

  label: {
    fontSize: 0.75;
    textTransform: uppercase;
    letterSpacing: '0.1em';
    color: $colorFdMutedForeground;
    marginBottom: 12;
    if (accent) color: $colorFdPrimary;
  }

  title: {
    fontSize: 1.875;
    fontWeight: bold;
    marginBottom: 16;
    $md: { fontSize: 2.25; }
  }

  desc: {
    color: $colorFdMutedForeground;
    fontSize: 1.125;
  }

  return (
    <div>
      <div _label>{label}</div>
      <h2 _title>{title}</h2>
      <p _desc>{children}</p>
    </div>
  );
}

const HooksExample = code /*tsx*/ `
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

const ClassExample = code /*tsx*/ `
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
