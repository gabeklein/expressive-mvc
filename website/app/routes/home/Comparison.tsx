import type React from 'react';
import { useState } from 'react';
import code from '@/components/Snippet';

export function Comparison() {
  const [tab, setTab] = useState(0);
  const [derived, setDerived] = useState(false);
  const active = TABS[tab];

  return (
    <section className="border-b border-fd-border">
      <div className="mx-auto max-w-(--content-width) py-24 px-6">
        <div className="max-w-2xl mb-12">
          <div className="text-xs uppercase tracking-widest text-fd-muted-foreground mb-3">
            Return-shape parity
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Everyone exposes the same hook. Only one is free to build.
          </h2>
          <p className="text-fd-muted-foreground text-lg">
            Hold the consumer fixed and the only variable is what it costs to
            build the reusable unit. Expressive is the odd one out - writes are
            assignments, and the same class is local <em>and</em> shareable
            without a rewrite.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <Panel accent label="Expressive" tag="the odd one out">
            <ExprUnit />
            <ExprConsumer />
            <ul className="text-sm text-fd-muted-foreground leading-relaxed mt-4 space-y-1.5">
              <li>The reusable unit is the class. Zero setters - writes are assignment.</li>
              <li>
                <code className="bg-fd-muted px-1.5 py-0.5 rounded">.use()</code> is local
                and per-mount; <code className="bg-fd-muted px-1.5 py-0.5 rounded">
                  &lt;Provider of={'{FooBarBaz}'}&gt;
                </code>{' '}
                + <code className="bg-fd-muted px-1.5 py-0.5 rounded">.get()</code> shares
                the same class - no second implementation.
              </li>
            </ul>
          </Panel>

          <Panel label="The rest" tag="one artifact per scope">
            <div className="flex flex-wrap gap-1.5 mb-4">
              {TABS.map((t, i) => (
                <button
                  key={t.label}
                  onClick={() => setTab(i)}
                  className={`rounded-full font-mono text-sm py-1 px-3 transition-colors ${
                    i === tab
                      ? 'bg-fd-primary text-fd-primary-foreground'
                      : 'bg-fd-muted/50 text-fd-muted-foreground hover:bg-fd-muted'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
            <active.Unit />
            {active.Consumer && <active.Consumer />}
            <p className="text-sm text-fd-muted-foreground leading-relaxed mt-4">
              <span className="text-fd-primary font-medium">The catch. </span>
              {active.note}
            </p>
          </Panel>
        </div>

        <Glance />

        <div className="mt-12 text-center">
          <button
            onClick={() => setDerived((v) => !v)}
            className="text-sm font-medium text-fd-primary hover:opacity-80">
            {derived ? '- Hide the derived value' : '+ Now add a derived value'}
          </button>
        </div>

        {derived && <Derived />}
      </div>
    </section>
  );
}

interface PanelProps {
  label: string;
  tag: string;
  accent?: boolean;
  children: React.ReactNode;
}

function Panel({ label, tag, accent, children }: PanelProps) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        accent ? 'border-fd-primary/60 bg-fd-primary/[0.03]' : 'border-fd-border'
      }`}>
      <div className="flex items-baseline justify-between mb-4">
        <h3 className={`text-lg font-semibold ${accent ? 'text-fd-primary' : ''}`}>
          {label}
        </h3>
        <span className="text-xs uppercase tracking-widest text-fd-muted-foreground">
          {tag}
        </span>
      </div>
      {children}
    </div>
  );
}

function Glance() {
  return (
    <div className="mt-14 overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[640px]">
        <thead>
          <tr className="text-left text-fd-muted-foreground">
            <Th />
            <Th>Reusable unit</Th>
            <Th>Setters written</Th>
            <Th>Per-mount local</Th>
            <Th>Same code when shared?</Th>
          </tr>
        </thead>
        <tbody>
          <Row name="Expressive" accent unit="class FooBarBaz" setters="none (assign)" local="yes" shared="yes - add Provider, .get()" />
          <Row name="useState hook" unit="useFooBarBaz" setters="3" local="yes" shared="no - rebuild as Context" />
          <Row name="Zustand" unit="useFooBarBaz" setters="3 explicit" local="no - singleton" shared="yes (but never local)" />
          <Row name="Jotai" unit="useFooBarBaz" setters="none (per atom)" local="no - singleton" shared="needs Provider scope" />
          <Row name="Redux" unit="slice + store" setters="3 reducers" local="no" shared="-" />
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="font-medium uppercase tracking-widest text-xs py-3 px-4 border-b border-fd-border">
      {children}
    </th>
  );
}

function Row(props: {
  name: string;
  unit: string;
  setters: string;
  local: string;
  shared: string;
  accent?: boolean;
}) {
  const { name, unit, setters, local, shared, accent } = props;
  return (
    <tr className={accent ? 'bg-fd-primary/[0.04]' : ''}>
      <td className={`py-3 px-4 border-b border-fd-border font-semibold ${accent ? 'text-fd-primary' : ''}`}>
        {name}
      </td>
      <td className="py-3 px-4 border-b border-fd-border font-mono text-xs">{unit}</td>
      <td className="py-3 px-4 border-b border-fd-border">{setters}</td>
      <td className="py-3 px-4 border-b border-fd-border">{local}</td>
      <td className="py-3 px-4 border-b border-fd-border">{shared}</td>
    </tr>
  );
}

function Derived() {
  return (
    <div className="mt-8 border-t border-fd-border pt-10">
      <p className="text-center text-fd-muted-foreground mb-8">
        Say <code className="bg-fd-muted px-1.5 py-0.5 rounded">qux = foo * 2</code>. A
        getter tracks what it reads - no dependency array, no selector to memoize.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <DerivedCard label="Expressive"><DerivedExpr /></DerivedCard>
        <DerivedCard label="useMemo"><DerivedMemo /></DerivedCard>
        <DerivedCard label="Redux / reselect"><DerivedReselect /></DerivedCard>
      </div>
    </div>
  );
}

function DerivedCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-fd-muted-foreground mb-2">
        {label}
      </div>
      {children}
    </div>
  );
}

const ExprUnit = code /*tsx*/`
  import State from '@expressive/react';

  class FooBarBaz extends State {
    foo = 0;
    bar = '';
    baz = false;
  }
`;

const ExprConsumer = code /*tsx*/`
  function Widget() {
    const state = FooBarBaz.use();
    return (
      <button onClick={() => state.foo++}>
        {state.foo} {state.bar} {String(state.baz)}
      </button>
    );
  }
`;

const HookUnit = code /*tsx*/`
  import { useState } from 'react';

  function useFooBarBaz() {
    const [foo, setFoo] = useState(0);
    const [bar, setBar] = useState('');
    const [baz, setBaz] = useState(false);
    return { foo, bar, baz, setFoo, setBar, setBaz };
  }
`;

const SharedConsumer = code /*tsx*/`
  function Widget() {
    const { foo, bar, baz, setFoo } = useFooBarBaz();
    return (
      <button onClick={() => setFoo(foo + 1)}>
        {foo} {bar} {String(baz)}
      </button>
    );
  }
`;

const ZustandUnit = code /*tsx*/`
  import { create } from 'zustand';

  const useFooBarBaz = create((set) => ({
    foo: 0, bar: '', baz: false,
    setFoo: (foo) => set({ foo }),
    setBar: (bar) => set({ bar }),
    setBaz: (baz) => set({ baz }),
  }));
`;

const JotaiUnit = code /*tsx*/`
  import { atom, useAtom } from 'jotai';

  const fooAtom = atom(0);
  const barAtom = atom('');
  const bazAtom = atom(false);

  function useFooBarBaz() {
    const [foo, setFoo] = useAtom(fooAtom);
    const [bar, setBar] = useAtom(barAtom);
    const [baz, setBaz] = useAtom(bazAtom);
    return { foo, bar, baz, setFoo, setBar, setBaz };
  }
`;

const ReduxUnit = code /*tsx*/`
  import { createSlice, configureStore } from '@reduxjs/toolkit';

  const slice = createSlice({
    name: 'fooBarBaz',
    initialState: { foo: 0, bar: '', baz: false },
    reducers: {
      setFoo: (s, a) => { s.foo = a.payload; },
      setBar: (s, a) => { s.bar = a.payload; },
      setBaz: (s, a) => { s.baz = a.payload; },
    },
  });

  const store = configureStore({ reducer: slice.reducer });
`;

const DerivedExpr = code /*tsx*/`
  class FooBarBaz extends State {
    foo = 0;
    get qux() {
      return this.foo * 2;
    }
  }
`;

const DerivedMemo = code /*tsx*/`
  const qux = useMemo(
    () => foo * 2,
    [foo],
  );
`;

const DerivedReselect = code /*tsx*/`
  const selectQux = createSelector(
    [(s) => s.fooBarBaz.foo],
    (foo) => foo * 2,
  );
`;

const TABS = [
  {
    label: 'useState',
    Unit: HookUnit,
    Consumer: SharedConsumer,
    note: 'Clean locally, but this hook cannot be shared. The moment two siblings need one instance, you throw it away and rebuild as the Context version - provider, useMemo, guard hook.',
  },
  {
    label: 'Zustand',
    Unit: ZustandUnit,
    Consumer: SharedConsumer,
    note: 'A module singleton - every Widget shares one state. A genuinely local, per-mount store needs useState(() => createStore(...)) plus context. More glue, not less.',
  },
  {
    label: 'Jotai',
    Unit: JotaiUnit,
    Consumer: SharedConsumer,
    note: 'Module atoms are shared too. Per-mount-local means minting atoms inside the hook (useMemo ×3) or scoping them with a <Provider>.',
  },
  {
    label: 'Redux',
    Unit: ReduxUnit,
    Consumer: undefined,
    note: 'No honest local variant - the store is a singleton by design. Per-component instances simply are not the model.',
  },
];
