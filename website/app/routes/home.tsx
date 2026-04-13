import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { Link } from 'react-router';
import React from 'react';
import { Background } from '@/components/AnimateBG';
import { Logo } from '@/components/Logo';

export const layoutOptions: BaseLayoutProps = {
  nav: { title: <Logo /> },
  links: [
    { text: 'Docs', url: '/docs' },
    { text: 'Playground', url: '/examples' }
  ],
  githubUrl: 'https://github.com/gabeklein/expressive-state'
};

export function meta() {
  return [
    { title: 'Expressive State' },
    {
      name: 'description',
      content: 'A class-based state backbone for modern UI applications'
    }
  ];
}

export default function Home() {
  $contentWidth: "1080px";
  
  return (
    <HomeLayout {...layoutOptions}>
      <Background />
      <Hero />
      <Problem />
      <Solution />
      <Benefits />
      <CTA />
    </HomeLayout>
  );
}

function Hero() {
  borderBottom: `1px solid`;
  borderColor: $colorFdBorder;
  boxSizing: borderBox;
  height: `calc(100vh - 56px)`;
  display: flex;
  alignItems: center;
  justifyContent: center;

  inner: {
    margin: 0, auto;
    maxWidth: 1024;
    padding: 96, 24;
    textAlign: center;
    $md: {
      padding: 128, 24;
    }
  }

  badge: {
    display: inlineBlock;
    marginBottom: 24;
    fontSize: 0.75;
    textTransform: uppercase;
    letterSpacing: '0.1em';
    color: $colorFdMutedForeground;
  }

  heading: {
    fontSize: 3.0;
    fontFamily: Rubik;
    fontWeight: 300;
    maxWidth: 10.0;
    margin: 0, auto;
    fontWeight: bold;
    letterSpacing: '-0.025em';
    lineHeight: 1.2;
    marginBottom: 24;
    $md: { fontSize: 4.5; }

    accent: {
      color: $colorFdPrimary;
    }
  }

  subtitle: {
    fontSize: 1.125;
    color: $colorFdMutedForeground;
    maxWidth: 672;
    margin: 0, auto;
    marginBottom: 40;
    $md: { fontSize: 1.25; }
  }

  install: {
    marginTop: 48;
    display: "inline-block";
    fontFamily: monospace;
    fontSize: 0.875, rem;
    background: $colorFdMuted;
    padding: 12, 20;
    borderRadius: 8;
    color: $colorFdMutedForeground;
  }

  return (
    <section>
      <div _inner>
        <div _badge>State management, reorganized</div>
        <h1 _heading>
          What if state had it's own Component?
        </h1>
        <p _subtitle>
          Expressive State consolidates your application state into
          plain classes. No reducers, no selectors, no dependency arrays. Just
          data, behavior, and lifecycle in one place.
        </p>
        <NavigateButtons />
        <div _install>npm install @expressive/react</div>
      </div>
    </section>
  );
}

function NavigateButtons  (){
  display: flex;
  flexDirection: column;
  gap: 12;
  justifyContent: center;
  $sm: { flexDirection: row; }

  Link: {
    display: "inline-flex";
    alignItems: center;
    justifyContent: center;
    radius: round;
    fontWeight: 500;
    padding: 12, 24;
    textDecoration: none;
    transition: `opacity 0.2s, background-color 0.2s`;
  }

  primary: {
    background: $colorFdPrimary;
    color: $colorFdPrimaryForeground;
    $hover: { opacity: 0.9; }
  }

  secondary: {
    border: $colorFdBorder;
    color: inherit;
    $hover: { background: $colorFdMuted; }
  }

  return (
    <div>
      <Link _primary to="/docs/getting-started">
        Get Started
      </Link>
      <Link _secondary to="/docs/why-classes">
        Why Classes?
      </Link>
    </div>
  );
}

function Problem() {
  borderBottom: 1, solid;
  borderColor: $colorFdBorder;

  inner: {
    margin: 0, auto;
    maxWidth: $contentWidth;
    padding: 96, 24;
  }

  header: {
    maxWidth: 672;
    marginBottom: 48;
  }

  label: {
    fontSize: 0.75;
    textTransform: uppercase;
    letterSpacing: '0.1em';
    color: $colorFdMutedForeground;
    marginBottom: 12;
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

    code: {
      fontSize: 0.875;
      background: $colorFdMuted;
      padding: 2, 6;
      borderRadius: 4;
    }
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
        <div _header>
          <div _label>The problem</div>
          <h2 _title>Hooks don't scale with your features.</h2>
          <p _desc>
            React hooks organize code around <em>when it runs</em>, not what it
            means. As features grow, related logic gets smeared across{' '}
            <code>useState</code>,{' '}
            <code>useEffect</code>,{' '}
            <code>useCallback</code>, and{' '}
            <code>useMemo</code> calls.
          </p>
        </div>
        <DynamicCodeBlock lang="tsx" code={HOOKS_EXAMPLE} />
        <p _caption>
          Seven hooks. Two dependency arrays. A race condition waiting to
          happen. And none of it testable without full UI.
        </p>
      </div>
    </section>
  );
}

function Solution() {
  borderBottom: `1px solid`;
  borderColor: $colorFdBorder;
  background: `color-mix(in srgb, var(--color-fd-muted) 30%, transparent)`;

  inner: {
    margin: 0, auto;
    maxWidth: $contentWidth;
    padding: 96, 24;
  }

  header: {
    maxWidth: 672;
    marginBottom: 48;
  }

  label: {
    fontSize: 0.75;
    textTransform: uppercase;
    letterSpacing: '0.1em';
    color: $colorFdPrimary;
    marginBottom: 12;
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

  caption: {
    color: $colorFdMutedForeground;
    marginTop: 24;
    textAlign: center;
    fontStyle: italic;
  }

  return (
    <section>
      <div _inner>
        <div _header>
          <div _label>The solution</div>
          <h2 _title>One class. One place. One truth.</h2>
          <p _desc>
            Expressive puts the entire feature in a single class. Fields are
            reactive. Computed values track their own dependencies. Async is
            declarative. The component becomes a pure projection of the class.
          </p>
        </div>
        <DynamicCodeBlock lang="tsx" code={CLASS_EXAMPLE} />
        <p _caption>
          No dependency arrays. No stale closures. No race conditions. Testable
          without rendering. And every tool you already have for reading code
          just works.
        </p>
      </div>
    </section>
  );
}

function Benefits() {
  borderBottom: currentColor;
  borderColor: $colorFdBorder;

  inner: {
    margin: 0, auto;
    maxWidth: $contentWidth;
    padding: 96, 24;
  }

  header: {
    maxWidth: 672;
    marginBottom: 64;
  }

  label: {
    fontSize: 0.75;
    textTransform: uppercase;
    letterSpacing: '0.1em';
    color: $colorFdMutedForeground;
    marginBottom: 12;
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

  grid: {
    display: grid;
    gridTemplateColumns: '1fr';
    gap: 32;
    $md: { gridTemplateColumns: '1fr 1fr'; }
  }

  return (
    <section>
      <div _inner>
        <div _header>
          <div _label>What you get</div>
          <h2 _title>A state backbone for your application.</h2>
          <p _desc>
            Expressive is designed to be the place where data, behavior, and
            lifecycle live - so components can go back to doing what they do
            best: describing UI.
          </p>
        </div>
        <div _grid>
          <Benefit title="Cohesive by default">
            Related state, derived values, lifecycle, and behavior all live in
            one place. Open a class, read it top-to-bottom, understand the feature.
          </Benefit>
          <Benefit title="No dependency arrays">
            Computed values and effects track what they read automatically.
            Forgetting a dependency is impossible - you would have to read a
            value without accessing it.
          </Benefit>
          <Benefit title="Testable without rendering">
            State classes are plain objects. Create with .new(), call methods,
            assert properties. No @testing-library, no act(), no DOM.
          </Benefit>
          <Benefit title="Async is built in">
            Async factories integrate with Suspense. Required placeholders
            suspend until resolved. No query library, no middleware, no thunks.
          </Benefit>
          <Benefit title="Type-safe context">
            The class is the context key. No createContext&lt;T&gt;, no default
            values, no manual Provider/Consumer pairs. Full inference automatically.
          </Benefit>
          <Benefit title="Coexists with hooks">
            No big-bang rewrite. Migrate one feature at a time. Leave simple
            useState calls alone. Expressive is a tool for complexity, not a
            replacement for hooks.
          </Benefit>
          <Benefit title="Refactor-friendly">
            Rename a field and TypeScript catches every usage. The class is the
            type. Go-to-definition, find-references, and outline views all work
            exactly as you expect.
          </Benefit>
          <Benefit title="AI and human readable">
            Classes are self-contained units with explicit shapes. A reviewer -
            human or AI - can load a feature into memory without chasing hooks
            across files.
          </Benefit>
        </div>
      </div>
    </section>
  );
}

interface BenefitProps {
  title: string;
  children: React.ReactNode;
}

function Benefit({ title, children }: BenefitProps) {
  borderLeft: $colorFdPrimary, 2;
  paddingLeft: 20;

  h3: {
    fontSize: 1.125;
    fontWeight: 600;
    marginBottom: 8;
  }

  p: {
    color: $colorFdMutedForeground;
    lineHeight: 1.625;
  }

  return (
    <div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

function CTA() {
  inner: {
    margin: 0, auto;
    maxWidth: 768;
    padding: 96, 24;
    textAlign: center;
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
    marginBottom: 40;
  }

  actions: {
    display: flex;
    flexDirection: column;
    gap: 12;
    justifyContent: center;
    $sm: { flexDirection: row; }

    Link: {
      display: inlineFlex;
      alignItems: center;
      justifyContent: center;
      borderRadius: 999;
      fontWeight: 500;
      padding: 12, 24;
      textDecoration: none;
      transition: `opacity 0.2s, background-color 0.2s`;
    }

    primary: {
      background: $colorFdPrimary;
      color: $colorFdPrimaryForeground;
      $hover: { opacity: 0.9; }
    }

    secondary: {
      border: $colorFdBorder;
      color: inherit;
      $hover: { background: $colorFdMuted; }
    }
  }

  return (
    <section>
      <div _inner>
        <h2 _title>Ready to move state out of components?</h2>
        <p _desc>
          Start with one feature. Leave everything else alone. See how it feels.
        </p>
        <div _actions>
          <Link _primary to="/docs/getting-started">
            Getting Started
          </Link>
          <Link _secondary to="/docs/migrating-from-hooks">
            Migration Guide
          </Link>
          <Link _secondary to="/docs/comparisons">
            Compare
          </Link>
        </div>
      </div>
    </section>
  );
}

const HOOKS_EXAMPLE = `
function UserSettings({ userId }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [initial, setInitial] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(\`/api/users/\${userId}\`)
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
}`;

const CLASS_EXAMPLE = `
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
    const res = await fetch(\`/api/users/\${this.userId}\`);
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
}`;
