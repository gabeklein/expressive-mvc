import { Children, type ReactNode } from 'react';
import { Component, get, ref } from '@expressive/react';
import { Hash } from '@/components/Hash';
import Playground from '@/components/Playground';
import code from '@/components/Snippet';

export class More extends Component {
  hash = get(Hash);

  tab = 0;
  tabs = {
    Async,
    Forms,
    Molecules,
    Singletons,
    Testing,
  };

  // Bridge the shared Hash to this deck: a #slug matching a tab label
  // selects it and scrolls the section into view.
  section = ref<HTMLElement>((el) => {
    const { hash } = this;
    const apply = () => {
      const i = Object.keys(this.tabs).findIndex(
        (label) => label.toLowerCase() === hash.active,
      );
      if (i < 0) return;
      this.tab = i;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    apply();
    return hash.set('active', apply);
  });

  get active() {
    return Object.values(this.tabs)[this.tab];
  }

  get Active() {
    return this.active;
  }

  render() {
    const { Active } = this;

    return (
      <section ref={this.section} id="more" className="panel">
        <div className="mx-auto max-w-(--content-width) px-6 py-16 md:py-24">
          <div className="max-w-2xl mx-auto text-center mb-4">
            <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
              That and more, built in.
            </h2>
          </div>

          <div className="flex flex-wrap justify-center gap-1 p-1 mb-10 w-fit mx-auto rounded-2xl bg-fd-muted/50">
            {Object.keys(this.tabs).map((label, i) => (
              <button
                key={label}
                onClick={() => (this.tab = i)}
                className={`rounded-full text-sm font-medium py-1 px-3 transition-colors ${
                  i === this.tab
                    ? 'bg-fd-background text-fd-foreground shadow-sm'
                    : 'text-fd-muted-foreground'
                }`}>
                {label}
              </button>
            ))}
          </div>

          <Active />
        </div>
      </section>
    );
  }
}

const mono = 'font-mono text-sm bg-fd-muted px-1.5 py-0.5 rounded';

function Tab({
  title,
  to,
  children,
}: {
  title: string;
  to?: string;
  children: ReactNode;
}) {
  const [blurb, example, ...rest] = Children.toArray(children);

  return (
    <>
      <div className="max-w-2xl mx-auto text-center mb-10">
        <h3 className="font-display text-2xl md:text-3xl font-bold tracking-tight mb-4">
          {title}
        </h3>
        <p className="text-fd-muted-foreground text-lg">{blurb}</p>
      </div>

      <div className="code-nowrap max-w-3xl mx-auto">
        {example}
        {to && <Playground to={to} />}
      </div>

      {rest}
    </>
  );
}

function InstructionsNote() {
  return (
    <p className="text-fd-muted-foreground text-lg leading-relaxed max-w-3xl mx-auto mt-10 text-center">
      Powered by <em>instructions</em> - property helpers that give a field
      special behavior. <code className={mono}>set()</code> handles values and
      async, <code className={mono}>get()</code> pulls from context,{' '}
      <code className={mono}>ref()</code> tracks DOM nodes, and you can define
      your own.
    </p>
  );
}

function Async() {
  return (
    <Tab title="Async without ceremony." to="/examples/essentials/async">
      <>
        An async <code className={mono}>set()</code> suspends render until it
        resolves. A <code className={mono}>Component</code> brings its own{' '}
        <code className={mono}>fallback</code> and its own error boundary via{' '}
        <code className={mono}>catch()</code> - no{' '}
        <code className={mono}>isPending</code> flags, client to provide, or
        cache keys.
      </>
      <AsyncCode />
      <InstructionsNote />
    </Tab>
  );
}

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

function Forms() {
  return (
    <Tab title="Forms as just fields." to="/examples/apps/forms">
      <>
        One field per input, one method for submit. A tiny base class you own
        binds the inputs - no <code className={mono}>register</code>, resolvers,
        or <code className={mono}>&lt;Controller&gt;</code>.
      </>
      <FormsCode />
      <InstructionsNote />
    </Tab>
  );
}

const FormsCode = code /*tsx*/`
  import React from 'react';
  import { Form } from "@components/form"

  // Form can be a ~30 line base class _you_ write once, not a
  // dependency - built on the ref() instruction to bind inputs.
  // Full example in the Playground.
  class MyForm extends Form {
    firstname = '';
    lastname = '';
    email = '';

    submit(event: React.FormEvent) {
      event.preventDefault();

      const { firstname, lastname, email } = this;

      if (!firstname || !lastname || !email) {
        alert('Please fill out all fields');
        return;
      }

      alert('Submitting ' + firstname + ' ' + lastname);
    }

    render() {
      const { bind, submit } = this;

      return (
        <form onSubmit={submit}>
          <input ref={bind.firstname} placeholder="Firstname" />
          <input ref={bind.lastname} placeholder="Lastname" />
          <input ref={bind.email} placeholder="Email Address" />
          <button type="submit">Submit</button>
        </form>
      );
    }
  }
`;

function Molecules() {
  return (
    <Tab
      title="Components compose by subclass."
      to="/examples/composition/subcomponents">
      <>
        A base owns structure and behavior; PascalCase subcomponents are seams a
        subclass overrides for appearance. Your own behavior-complete widgets -
        Table, Toast, Picker - without the config soup or shadcn.
      </>
      <MoleculesCode />
    </Tab>
  );
}

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

function Singletons() {
  return (
    <Tab
      title="Global state, no ceremony."
      to="/examples/composition/singletons">
      <>
        Create a State once with <code className={mono}>.new()</code> and it
        parks in global context. Any component reads it with{' '}
        <code className={mono}>.get()</code> - app-wide session, theme, or
        viewport with no store, no Provider, no prop drilling.
      </>
      <SingletonsCode />
    </Tab>
  );
}

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

  // Creating outside components activates and parks in global context.
  Session.new();

  // Any component reaches it with .get() - no props, no Provider.
  function Status() {
    const { user, login } = Session.get();

    return user
      ? <p>Signed in as {user}</p>
      : <button onClick={login}>Log in</button>;
  }
`;

function Testing() {
  return (
    <Tab title="Test the class, not the DOM.">
      <>
        State classes are plain objects - create with{' '}
        <code className={mono}>.new()</code>, call methods, assert on
        properties. Whole features tested with just{' '}
        <code className={mono}>expect</code> - no{' '}
        <code className={mono}>act()</code>, no @testing-library.
      </>
      <TestingCode />
    </Tab>
  );
}

const TestingCode = code /*tsx*/`
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
