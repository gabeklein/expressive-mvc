import React from 'react';

import code from '@/components/Snippet';

export function Problem() {
  borderBottom: 1, solid;
  borderColor: $colorFdBorder;

  inner: {
    margin: 0, auto;
    maxWidth: $contentWidth;
    padding: 96, 24;
  }

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
    <section>
      <div _inner>
        <Header label="The problem" title="Hooks don't scale with your features.">
          React hooks organize code around <em>when it runs</em>, not what it
          means. As features grow, related logic gets smeared across{' '}
          <code>useState</code>,{' '}
          <code>useEffect</code>,{' '}
          <code>useCallback</code>, and{' '}
          <code>useMemo</code> calls.
        </Header>
        <HooksExample />
        <p _caption>
          Seven hooks. Two dependency arrays. A race condition waiting to
          happen. And none of it testable without full UI.
        </p>
      </div>
    </section>
  );
}

export function Solution() {
  borderBottom: `1px solid`;
  borderColor: $colorFdBorder;
  background: `color-mix(in srgb, var(--color-fd-muted) 30%, transparent)`;

  inner: {
    margin: 0, auto;
    maxWidth: $contentWidth;
    padding: 96, 24;
  }

  caption: {
    color: $colorFdMutedForeground;
    marginTop: 24;
    textAlign: center;
    fontStyle: italic;
  }

  return (
    <section>
      <div _inner>
        <Header accent label="The solution" title="One hook. Any amount of logic.">
          Expressive helps contain even entire features in a single class. Fields are
          reactive. Computed values track their own dependencies. Async is
          declarative. The component becomes a pure projection of the class.
        </Header>
        <ClassExample />
        <p _caption>
          No dependency arrays. No stale closures. No race conditions. Testable
          without rendering. And every tool you already have for reading code
          just works.
        </p>
      </div>
    </section>
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
  function UserSettings({ userId }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [initial, setInitial] = useState(null);

    useEffect(() => {
      let cancelled = false;
      fetch("/api/users/" + userId)
        .then(r => r.json())
        .then(data => {
          if (cancelled) return;
          setName(data.name);
          setEmail(data.email);
          setInitial({ name: data.name, email: data.email });
        });
      return () => { cancelled = true; };
    }, [userId]);

    const dirty = useMemo(() =>
      initial && (name !== initial.name || email !== initial.email),
      [name, email, initial]
    );

    const save = useCallback(async () => {
      setSaving(true);
      try {
        await api.update({ name, email });
        setInitial({ name, email });
      } catch (e) {
        setError(e.message);
      } finally {
        setSaving(false);
      }
    }, [name, email]);

    // ...and now the render
  }
`;

const ClassExample = code /*tsx*/ `
  import { State, set } from '@expressive/react';

  class UserSettings extends State {
    // simple values tracked automatically
    name = '';
    email = '';
    saving = false;
    error: string | null = null;

    // \`set\` instruction are factories for special behaviors
    // This suspends until defined, if accessed early. Never undefined.
    userId = set<string>();

    // Async factory runs on access, suspends until ready.
    initial = set(async () => {
      const res = await fetch("/api/users/" + this.userId);
      const data = await res.json();
      this.name = data.name;
      this.email = data.email;
      return { name: data.name, email: data.email };
    });

    // Computed values track access, always up to date.
    dirty = set((from) =>
      from.name !== from.initial.name ||
      from.email !== from.initial.email
    );

    // Simply async manipulate state, no middleware or thunks required.
    async save() {
      this.saving = true;
      try {
        await api.update({ name: this.name, email: this.email });
        this.initial = { name: this.name, email: this.email };
      } catch (e) {
        this.error = e.message;
      } finally {
        this.saving = false;
      }
    }
  }
`;
