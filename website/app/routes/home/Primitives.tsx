import { Children, type ReactNode } from 'react';
import { Component, get, ref } from '@expressive/react';
import { Hash } from '@/components/Hash';
import Playground from '@/components/Playground';
import ScrollOverflowControls from '@/components/ScrollOverflowControls';
import code from '@/components/Snippet';

export class Primitives extends Component {
  hash = get(Hash);

  tab = 0;
  tabsStuck = false;
  canScrollTabsLeft = false;
  canScrollTabsRight = false;
  tabs = {
    Async,
    Computed,
    Molecules,
    Forms,
    Singletons,
    Testing,
    Instructions,
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

  tabBar = ref<HTMLDivElement>((el) => {
    let frame = 0;

    const update = () => {
      frame = 0;
      this.tabsStuck = el.getBoundingClientRect().top <= 56;
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  });

  tabScroller = ref<HTMLDivElement>((el) => {
    let frame = 0;
    const media = window.matchMedia('(max-width: 767px)');

    const update = () => {
      frame = 0;
      const remaining = el.scrollWidth - el.clientWidth - el.scrollLeft;
      this.canScrollTabsLeft = media.matches && el.scrollLeft > 1;
      this.canScrollTabsRight = media.matches && remaining > 1;
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    el.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    media.addEventListener('change', schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      el.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      media.removeEventListener('change', schedule);
    };
  });

  content = ref<HTMLDivElement>();

  select(i: number) {
    this.tab = i;

    queueMicrotask(() => {
      const content = this.content.current;
      const tabBar = this.tabBar.current;
      if (!content || !tabBar) return;

      const top =
        window.scrollY +
        content.getBoundingClientRect().top -
        tabBar.offsetHeight -
        96;

      if (top < window.scrollY) {
        window.scrollTo({
          top,
          behavior: 'smooth',
        });
      }

      requestAnimationFrame(() => this.updateTabScrollState());
    });
  }

  scrollTabs(direction: -1 | 1) {
    this.tabScroller.current?.scrollBy({
      left: direction * 160,
      behavior: 'smooth',
    });
  }

  updateTabScrollState() {
    const el = this.tabScroller.current;
    if (!el) return;

    const remaining = el.scrollWidth - el.clientWidth - el.scrollLeft;
    const mobile = window.matchMedia('(max-width: 767px)').matches;
    this.canScrollTabsLeft = mobile && el.scrollLeft > 1;
    this.canScrollTabsRight = mobile && remaining > 1;
  }

  get active() {
    return Object.values(this.tabs)[this.tab];
  }

  get Active() {
    return this.active;
  }

  render() {
    const { Active } = this;
    const moleculesActive = Active === Molecules;

    return (
      <section ref={this.section} id="more" className="panel px-6 lg:px-[50px]">
        <div className="mx-auto max-w-(--content-width) py-16 md:py-24">
          <div className="max-w-2xl mx-auto text-center mb-4">
            <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
              All the basics, built right in.
            </h2>
          </div>

          <div
            ref={this.tabBar}
            className={`sticky top-14 z-20 mb-10 ml-[calc(50%-50vw)] w-screen overflow-hidden px-6 py-3 transition-colors [--more-panel-bg:color-mix(in_oklab,var(--color-fd-foreground)_2%,var(--color-fd-background))] [--tab-scroll-bg:color-mix(in_oklab,var(--color-fd-muted)_50%,transparent)] md:overflow-visible lg:px-[50px] ${
              this.tabsStuck
                ? 'bg-(--more-panel-bg)'
                : 'bg-transparent'
            }`}>
            <div className="relative mx-auto w-fit max-w-full">
              <div
                ref={this.tabScroller}
                className="flex w-fit max-w-full gap-[0.25em] overflow-x-auto rounded-[999px] bg-(--tab-scroll-bg) p-[0.25em] text-base [scrollbar-width:none] md:flex-wrap md:justify-center md:overflow-visible md:text-sm [&::-webkit-scrollbar]:hidden">
                {Object.keys(this.tabs).map((label, i) => (
                  <button
                    key={label}
                    onClick={() => this.select(i)}
                    className={`shrink-0 whitespace-nowrap rounded-[999px] px-[1em] py-[0.625em] text-[inherit] leading-[1.5] font-medium transition-colors ${
                      i === this.tab
                        ? 'bg-fd-background text-fd-foreground shadow-sm'
                        : 'text-fd-muted-foreground'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>

              <ScrollOverflowControls
                canScrollLeft={this.canScrollTabsLeft}
                canScrollRight={this.canScrollTabsRight}
                leftLabel="Scroll tabs left"
                rightLabel="Scroll tabs right"
                onScrollLeft={() => this.scrollTabs(-1)}
                onScrollRight={() => this.scrollTabs(1)}
                hideAt="md:hidden"
              />
            </div>
          </div>

          <div ref={this.content}>
            <div className={moleculesActive ? undefined : 'hidden'}>
              <Molecules />
            </div>
            {!moleculesActive && <Active />}
          </div>
        </div>
      </section>
    );
  }
}

function Tab({
  title,
  to,
  children,
}: {
  title: ReactNode;
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

function Instructions() {
  return (
    <Tab title="Fields with built-in behavior.">
      <>
        Instructions are property initializers with runtime behavior. You still
        read them like fields; the initializer decides what kind of field it is.
        Make your own too, with <code>def</code>.
      </>

      <InstructionsCode />
    </Tab>
  );
}

const InstructionsCode = code /*tsx*/`
  import State, { get, hot, ref, set } from '@expressive/react';

  class Profile extends State {
    first = 'Ada';
    last = 'Lovelace';

    // factory with Suspense if async
    user = set(async () => fetchUser());

    // validate or side-effect whenever assigned
    email = set('', (next) => {
      if (!next.includes('@')) throw false;
    });

    // computed field, in lieu of a getter
    label = set(({ first, last, theme }) => {
      return theme.format(first + ' ' + last);
    });

    // another class instance from context
    theme = get(Theme);

    // a single DOM node or mutable imperative value
    dialog = ref<HTMLDialogElement>();

    // a ref proxy for form fields (inputs.first, inputs.last)
    inputs = ref(this);

    // reactive object and array mutation
    filters = hot({ query: '', active: true });
    todos = hot([] as string[]);
  }
`;

function Async() {
  return (
    <Tab title="Async without ceremony" to="/examples/essentials/async">
      <>
        Accessing <code>set(async)</code> suspends until it resolves. A{' '}
        <code>Component</code> can define its own{' '}
        <code>fallback</code> and even error boundary via{' '}
        <code>catch()</code> - no{' '}
        <code>isPending</code> flags, client to provide, or
        cache keys.
      </>
      <AsyncCode />
    </Tab>
  );
}

const AsyncCode = code /*tsx*/`
  import { Component, set } from '@expressive/react';

  class Profile extends Component {
    fallback = <p>Loading...</p>;

    user = set(async () => {
      const res = await fetch('/api/user/1');

      if (!res.ok)
        throw new Error('Could not find the user.');

      const { first, last } = await res.json();

      return first + " " + last;
    });

    async catch(error: Error) {
      this.fallback = <p>{error.message}</p>;
    }

    render() {
      return <h1>Hello {this.user.name}!</h1>;
    }
  }

  const App = () => <Profile />;
`;

function Computed() {
  return (
    <Tab title="Derived state with getters">
      <>
        Put the formula where the data lives. Getters are memoized and
        dependency-tracked, so render stays simple without{' '}
        <code>useMemo</code>, selectors, or dependency arrays.
      </>
      <GettersCode />
    </Tab>
  );
}

const GettersCode = code /*tsx*/`
  import State, { hot } from '@expressive/react';

  type Item = { name: string; price: number; qty: number };

  class Cart extends State {
    items = hot([] as Item[]);
    taxRate = 0.0825;

    get total() {
      return this.subtotal * (1 + this.taxRate);
    }

    get subtotal() {
      return this.items.reduce(
        (sum, item) => sum + item.price * item.qty,
        0
      );
    }

    add(item: Item) {
      this.items.push(item);
    }
  }

  function Checkout() {
    const { items, subtotal, total } = Cart.get();

    return (
      <section>
        <p>{items.length} items</p>
        <p>Subtotal: {subtotal}</p>
        <p>Total: {total}</p>
      </section>
    );
  }
`;

function Forms() {
  return (
    <Tab title="Forms from just fields" to="/examples/apps/forms">
      <>
        One field per input, one method for submit. A tiny base class you own
        binds the inputs - no <code>register</code>, resolvers,
        or <code>&lt;Controller&gt;</code>.
      </>
      <FormsCode />
    </Tab>
  );
}

const FormsCode = code /*tsx*/`
  import { Form } from "@/components/form"

  // Form can be a ~30 line base class _you_ write once.
  // Here, \`bind\` is defined with a ref instruction.
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
      title={<>Components customized <span className="whitespace-nowrap">by subclass</span></>}
      to="/examples/composition/subcomponents">
      <>
        A base owns structure and behavior; PascalCase subcomponents are seams a
        subclass overrides for appearance. Your own behavior-complete widgets -
        Table, Toast, Picker - all without config soup or shadcn.
      </>
      <MoleculesCode />
    </Tab>
  );
}

const MoleculesCode = code /*tsx*/`
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
      title="Global state with no setup."
      to="/examples/composition/singletons">
      <>
        Create a State once with <code>.new()</code> and it parks in global
        context. Any component can find it with{' '}
        <code>.get()</code> - app-wide session, theme, or
        viewport with no store, Provider, or prop drilling.
      </>
      <SingletonsCode />
    </Tab>
  );
}

const SingletonsCode = code /*tsx*/`
  import State from '@expressive/react';

  class Session extends State {
    user: string | null = null;

    login() {
      this.user = 'Ada';
    }
  }

  // Creating outside components activates and parks in global context.
  Session.new();

  // Components still reach for it with .get() - no Provider needed.
  function Status() {
    const { user, login } = Session.get();

    return user
      ? <p>Signed in as {user}</p>
      : <button onClick={login}>Log in</button>;
  }
`;

function Testing() {
  return (
    <Tab title="Testable logic, without the DOM.">
      <>
        State and components are plain instances - create with{' '}
        <code>.new()</code>, call methods, assert on properties.
        Test whole workflows with only <code>expect</code> -{" "}
        no <code>act()</code>, not even React.
      </>
      <TestingCode />
    </Tab>
  );
}

const TestingCode = code /*tsx*/`
  import { LoginForm } from './LoginForm';

  it('will show admin state after login', async () => {
    const form = LoginForm.new();

    form.username = 'admin@example.com';
    form.password = 'correct-horse';

    const login = form.submit();

    expect(form.loading).toBe(true);
    expect(form.canSubmit).toBe(false);

    await login;

    expect(form.loading).toBe(false);
    expect(form.error).toBeUndefined();
    expect(form.user?.email).toBe('admin@example.com');
    expect(form.isAdmin).toBe(true);
    expect(form.avatarIcon.loaded).toBe(true);
  });
`;
