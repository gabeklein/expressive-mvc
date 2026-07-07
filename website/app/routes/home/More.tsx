import type React from 'react';
import State, { get, ref } from '@expressive/react';
import { Hash } from '@/components/Hash';
import Playground from '@/components/Playground';
import code from '@/components/Snippet';

interface Tab {
  label: string;
  title: string;
  blurb: React.ReactNode;
  code: ReturnType<typeof code>;
  to?: string;
}

class Tabs extends State {
  tab = 0;

  hash = get(Hash);

  // Bridge the shared Hash to this deck: a #slug matching a tab label
  // selects it and scrolls the section into view.
  section = ref<HTMLElement>((el) => {
    const { hash } = this;
    const apply = () => {
      const i = TABS.findIndex((t) => t.label.toLowerCase() === hash.active);
      if (i < 0) return;
      this.tab = i;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    apply();
    return hash.set('active', apply);
  });
}

export function More() {
  const state = Tabs.use();
  const active = TABS[state.tab];
  const Code = active.code;

  return (
    <section ref={state.section} id="more" className="panel">
      <div className="mx-auto max-w-(--content-width) px-6 py-16 md:py-24">
        <div className="max-w-2xl mx-auto text-center mb-8">
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
            More out of the box.
          </h2>
        </div>

        <div className="flex flex-wrap justify-center gap-1 p-1 mb-10 w-fit mx-auto rounded-2xl bg-fd-muted/50">
          {TABS.map((t, i) => (
            <button
              key={t.label}
              onClick={() => (state.tab = i)}
              className={`rounded-full text-sm font-medium py-1 px-3 transition-colors ${
                i === state.tab
                  ? 'bg-fd-background text-fd-foreground shadow-sm'
                  : 'text-fd-muted-foreground'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="max-w-2xl mx-auto text-center mb-10">
          <h3 className="font-display text-2xl md:text-3xl font-bold tracking-tight mb-4">
            {active.title}
          </h3>
          <p className="text-fd-muted-foreground text-lg">{active.blurb}</p>
        </div>

        <div className="code-nowrap max-w-3xl mx-auto">
          <Code />
          {active.to && <Playground to={active.to} />}
        </div>

        <p className="text-fd-muted-foreground text-lg leading-relaxed max-w-3xl mx-auto mt-10 text-center">
          Powered by <em>instructions</em> - property helpers that give a field
          special behavior. <code className={mono}>set()</code> handles values
          and async, <code className={mono}>get()</code> pulls from context,{' '}
          <code className={mono}>ref()</code> tracks DOM nodes, and you can
          define your own.
        </p>
      </div>
    </section>
  );
}

const mono = 'font-mono text-sm bg-fd-muted px-1.5 py-0.5 rounded';

const AsyncCode = code /*tsx*/`
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

const FormsCode = code /*tsx*/`
  import React from 'react';
  import { Form } from './Form';

  class MyForm extends Form {
    firstname = '';
    lastname = '';
    email = '';

    submit() {
      const { firstname, lastname, email } = this;

      if (!firstname || !lastname || !email) {
        alert('Please fill out all fields');
        return;
      }

      alert('Submitting ' + firstname + ' ' + lastname);
    }

    render() {
      const { input, submit } = this;

      return (
        <div>
          <input ref={input.firstname} placeholder="Firstname" />
          <input ref={input.lastname} placeholder="Lastname" />
          <input ref={input.email} placeholder="Email Address" />
          <button onClick={submit}>Submit</button>
        </div>
      );
    }
  }

  // Form is a ~30 line base class you write once, not a
  // dependency - built on the ref() instruction to two-way
  // bind inputs. Full source in the Playground.
`;

const MoleculesCode = code /*tsx*/`
  import React from 'react';
  import { Component } from '@expressive/react';

  // A behavior-complete base: owns data and selection,
  // leaves appearance to overrideable subcomponents.
  class Picker extends Component {
    items = [] as string[];
    selected = 0;

    choose(index: number) {
      this.selected = index;
    }

    // A visual seam - override the look, keep the wiring.
    Item({ index }: { index: number }) {
      return <>{this.items[index]}</>;
    }

    render() {
      return (
        <ul>
          {this.items.map((item, i) => (
            <li key={item} onClick={() => this.choose(i)}>
              <this.Item index={i} />
            </li>
          ))}
        </ul>
      );
    }
  }

  // Subclass fills in appearance; behavior is inherited.
  class FruitPicker extends Picker {
    items = ['Apple', 'Banana', 'Cherry'];

    Item({ index }: { index: number }) {
      const active = index === this.selected;
      return <>{active ? '🍎' : '🍏'} {this.items[index]}</>;
    }
  }
`;

const SingletonsCode = code /*tsx*/`
  import React from 'react';
  import State from '@expressive/react';

  // One instance for the whole app.
  class Session extends State {
    user: string | null = null;

    login() {
      this.user = 'Ada';
    }
  }

  // .new() activates it and parks it in global context.
  Session.new();

  // Any component reaches it with .get() - no props, no Provider.
  function Status() {
    const { user, login } = Session.get();

    return user
      ? <p>Signed in as {user}</p>
      : <button onClick={login}>Log in</button>;
  }

  // This page uses one: the tab you're reading follows the URL #hash.
`;

const TestingCode = code /*tsx*/`
  import { expect, it } from 'bun:test';
  import { Counter } from './Counter';

  it('will update on increment', async () => {
    const counter = Counter.new();

    counter.increment();
    counter.increment();

    expect(counter.count).toBe(2);
    expect(await counter.set()).toEqual(['count']);
  });

  // the Counter class from the top of this page,
  // tested as-is. No render, no DOM.
`;

const TABS: Tab[] = [
  {
    label: 'Async',
    title: 'Async without ceremony.',
    blurb: (
      <>
        An async <code className={mono}>set()</code> suspends render until it
        resolves. A <code className={mono}>Component</code> brings its own{' '}
        <code className={mono}>fallback</code> and its own error boundary via{' '}
        <code className={mono}>catch()</code> - no{' '}
        <code className={mono}>isPending</code> flags, client to provide, or
        cache keys.
      </>
    ),
    code: AsyncCode,
    to: '/examples/essentials/async',
  },
  {
    label: 'Forms',
    title: 'Forms are just fields.',
    blurb: (
      <>
        One field per input, one method for submit. A tiny base class you own
        binds the inputs - no <code className={mono}>register</code>, resolvers,
        or <code className={mono}>&lt;Controller&gt;</code>.
      </>
    ),
    code: FormsCode,
    to: '/examples/apps/forms',
  },
  {
    label: 'Molecules',
    title: 'Components compose by subclass.',
    blurb: (
      <>
        A base owns structure and behavior; PascalCase subcomponents are seams a
        subclass overrides for appearance. Your own behavior-complete widgets -
        Table, Toast, Picker - without the config soup or shadcn.
      </>
    ),
    code: MoleculesCode,
    to: '/examples/composition/subcomponents',
  },
  {
    label: 'Singletons',
    title: 'Global state, no ceremony.',
    blurb: (
      <>
        Create a State once with <code className={mono}>.new()</code> and it
        parks in global context. Any component reads it with{' '}
        <code className={mono}>.get()</code> - app-wide session, theme, or
        viewport with no store, no Provider, no prop drilling.
      </>
    ),
    code: SingletonsCode,
    to: '/examples/composition/singletons',
  },
  {
    label: 'Testing',
    title: 'Test the class, not the DOM.',
    blurb: (
      <>
        State classes are plain objects - create with{' '}
        <code className={mono}>.new()</code>, call methods, assert on
        properties. Whole features tested with just{' '}
        <code className={mono}>expect</code> - no{' '}
        <code className={mono}>act()</code>, no @testing-library.
      </>
    ),
    code: TestingCode,
  },
];
