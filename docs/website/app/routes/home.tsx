import type { Route } from './+types/home';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { Link } from 'react-router';

const HOOKS_EXAMPLE = `function UserSettings({ userId }) {
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

const CLASS_EXAMPLE = `class UserSettings extends State {
  userId = set<string>();
  name = '';
  email = '';
  saving = false;
  error = set<string | null>(null);

  initial = set(async () => {
    const res = await fetch(\`/api/users/\${this.userId}\`);
    const data = await res.json();
    this.name = data.name;
    this.email = data.email;
    return { name: data.name, email: data.email };
  });

  dirty = set((from) =>
    from.name !== from.initial.name ||
    from.email !== from.initial.email
  );

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

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Expressive State' },
    { name: 'description', content: 'A class-based state backbone for modern UI applications' },
  ];
}

export default function Home() {
  return (
    <HomeLayout nav={{ title: 'Expressive' }}>
      <Hero />
      <Problem />
      <Solution />
      <Benefits />
      <CTA />
    </HomeLayout>
  );
}

function Hero() {
  return (
    <section className="border-b border-fd-border">
      <div className="mx-auto max-w-5xl px-6 py-24 md:py-32 text-center">
        <div className="inline-block mb-6 text-xs uppercase tracking-widest text-fd-muted-foreground">
          State management, reorganized
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
          State that lives
          <br />
          <span className="text-fd-primary">where it belongs.</span>
        </h1>
        <p className="text-lg md:text-xl text-fd-muted-foreground max-w-2xl mx-auto mb-10">
          Expressive State moves your app's logic out of components and into plain classes.
          No reducers, no selectors, no dependency arrays. Just data, behavior, and lifecycle
          in one place - the way JavaScript was built for.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            className="inline-flex items-center justify-center bg-fd-primary text-fd-primary-foreground rounded-full font-medium px-6 py-3 hover:opacity-90 transition-opacity"
            to="/docs/getting-started"
          >
            Get Started
          </Link>
          <Link
            className="inline-flex items-center justify-center border border-fd-border rounded-full font-medium px-6 py-3 hover:bg-fd-muted transition-colors"
            to="/docs/why-classes"
          >
            Why Classes?
          </Link>
        </div>
        <div className="mt-12 inline-block font-mono text-sm bg-fd-muted px-5 py-3 rounded-lg text-fd-muted-foreground">
          npm install @expressive/react
        </div>
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section className="border-b border-fd-border">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-2xl mb-12">
          <div className="text-xs uppercase tracking-widest text-fd-muted-foreground mb-3">
            The problem
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Hooks don't scale with your features.
          </h2>
          <p className="text-fd-muted-foreground text-lg">
            React hooks organize code around <em>when it runs</em>, not what it means.
            As features grow, related logic gets smeared across <code className="text-sm bg-fd-muted px-1.5 py-0.5 rounded">useState</code>,{' '}
            <code className="text-sm bg-fd-muted px-1.5 py-0.5 rounded">useEffect</code>,{' '}
            <code className="text-sm bg-fd-muted px-1.5 py-0.5 rounded">useCallback</code>, and{' '}
            <code className="text-sm bg-fd-muted px-1.5 py-0.5 rounded">useMemo</code> calls.
          </p>
        </div>
        <DynamicCodeBlock lang="tsx" code={HOOKS_EXAMPLE} />
        <p className="text-fd-muted-foreground mt-6 text-center italic">
          Seven hooks. Two dependency arrays. A race condition waiting to happen.
          And none of this is testable without a renderer.
        </p>
      </div>
    </section>
  );
}

function Solution() {
  return (
    <section className="border-b border-fd-border bg-fd-muted/30">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-2xl mb-12">
          <div className="text-xs uppercase tracking-widest text-fd-primary mb-3">
            The solution
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            One class. One place. One truth.
          </h2>
          <p className="text-fd-muted-foreground text-lg">
            Expressive puts the entire feature in a single class. Fields are reactive.
            Computed values track their own dependencies. Async is declarative. The
            component becomes a pure projection of the class.
          </p>
        </div>
        <DynamicCodeBlock lang="tsx" code={CLASS_EXAMPLE} />
        <p className="text-fd-muted-foreground mt-6 text-center italic">
          No dependency arrays. No stale closures. No race conditions.
          Testable without rendering. And every tool you already have for reading code just works.
        </p>
      </div>
    </section>
  );
}

function Benefits() {
  const benefits = [
    {
      title: 'Cohesive by default',
      body: 'Related state, derived values, lifecycle, and behavior all live in one place. Open a class, read it top-to-bottom, understand the feature.',
    },
    {
      title: 'No dependency arrays',
      body: 'Computed values and effects track what they read automatically. Forgetting a dependency is impossible - you would have to read a value without accessing it.',
    },
    {
      title: 'Testable without rendering',
      body: 'State classes are plain objects. Create with .new(), call methods, assert properties. No @testing-library, no act(), no DOM.',
    },
    {
      title: 'Async is built in',
      body: 'Async factories integrate with Suspense. Required placeholders suspend until resolved. No query library, no middleware, no thunks.',
    },
    {
      title: 'Type-safe context',
      body: 'The class is the context key. No createContext<T>, no default values, no manual Provider/Consumer pairs. Full inference automatically.',
    },
    {
      title: 'Coexists with hooks',
      body: 'No big-bang rewrite. Migrate one feature at a time. Leave simple useState calls alone. Expressive is a tool for complexity, not a replacement for hooks.',
    },
    {
      title: 'Refactor-friendly',
      body: 'Rename a field and TypeScript catches every usage. The class is the type. Go-to-definition, find-references, and outline views all work exactly as you expect.',
    },
    {
      title: 'AI and human readable',
      body: 'Classes are self-contained units with explicit shapes. A reviewer - human or AI - can load a feature into memory without chasing hooks across files.',
    },
  ];

  return (
    <section className="border-b border-fd-border">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-2xl mb-16">
          <div className="text-xs uppercase tracking-widest text-fd-muted-foreground mb-3">
            What you get
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            A state backbone for your application.
          </h2>
          <p className="text-fd-muted-foreground text-lg">
            Expressive is designed to be the place where data, behavior, and lifecycle live -
            so components can go back to doing what they do best: describing UI.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {benefits.map((b) => (
            <div key={b.title} className="border-l-2 border-fd-primary pl-5">
              <h3 className="text-lg font-semibold mb-2">{b.title}</h3>
              <p className="text-fd-muted-foreground leading-relaxed">{b.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section>
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Ready to move state out of components?
        </h2>
        <p className="text-fd-muted-foreground text-lg mb-10">
          Start with one feature. Leave everything else alone. See how it feels.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            className="inline-flex items-center justify-center bg-fd-primary text-fd-primary-foreground rounded-full font-medium px-6 py-3 hover:opacity-90 transition-opacity"
            to="/docs/getting-started"
          >
            Getting Started
          </Link>
          <Link
            className="inline-flex items-center justify-center border border-fd-border rounded-full font-medium px-6 py-3 hover:bg-fd-muted transition-colors"
            to="/docs/migrating-from-hooks"
          >
            Migration Guide
          </Link>
          <Link
            className="inline-flex items-center justify-center border border-fd-border rounded-full font-medium px-6 py-3 hover:bg-fd-muted transition-colors"
            to="/docs/comparisons"
          >
            Compare
          </Link>
        </div>
      </div>
    </section>
  );
}
