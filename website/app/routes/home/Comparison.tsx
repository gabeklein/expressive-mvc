import Compare from '@/components/Compare';
import Playground from '@/components/Playground';
import code from '@/components/Snippet';

export function Comparison() {
  return (
    <section id="comparison" className="panel">
      <div className="mx-auto max-w-(--content-width) px-6 py-16 md:py-24">
        <div className="max-w-3xl mb-12">
          <div className="text-xs uppercase tracking-widest text-fd-muted-foreground mb-3">
            For local state
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">
            The same logic. <span className='text-nowrap'>Half the noise.</span>
          </h2>
          <p className="text-fd-muted-foreground text-lg">
            Say you want a reusable, component-owned <code className={mono}>useFooBarBaz</code>{' '}
            that re-renders on change. Same surface everywhere - only the cost
            of building it differs. Higher readability <small>(and fewer tokens)</small>.
          </p>
        </div>

        <Compare
          left={{ label: 'FooBarBaz', code: ExprCode }}
          right={[
            { label: 'Hooks', code: HookCode },
            { label: 'Zustand', code: ZustandCode },
            { label: 'Jotai', code: JotaiCode },
            { label: 'Redux', code: ReduxCode },
            { label: 'MobX', code: MobxCode },
          ]}
        />

        <Playground to="/examples/essentials/counter" />

        <p className="text-fd-muted-foreground text-lg leading-relaxed max-w-2xl mx-auto mt-10 text-center">
          With MVC, destructuring <em>is</em> the dependency list. Read a
          field, subscribe to it. 
          Nothing to declare, nothing to forget - no setters, no <code className={mono}>useCallback</code>,
          no store factory.
        </p>
      </div>
    </section>
  );
}

const mono = 'font-mono text-sm bg-fd-muted px-1.5 py-0.5 rounded';

const ExprCode = code /*tsx*/`
  import React from 'react';
  import State from '@expressive/react';

  class FooBarBaz extends State {
    foo = 0;
    bar = 'hello';
    baz = true;

    bump() {
      this.foo++;
    }
  }

  function Widget() {
    const { foo, bar, baz, bump } = FooBarBaz.use();

    return (
      <button onClick={bump}>
        {foo} · {bar} · {String(baz)}
      </button>
    );
  }
`;

const HookCode = code /*tsx*/`
  import React, { useState, useCallback } from 'react';

  function useFooBarBaz() {
    const [foo, setFoo] = useState(0);
    const [bar, setBar] = useState('hello');
    const [baz, setBaz] = useState(true);

    const bump = useCallback(() => setFoo(f => f + 1), []);

    return { foo, bar, baz, bump, setFoo, setBar, setBaz };
  }

  function Widget() {
    const { foo, bar, baz, bump } = useFooBarBaz();

    return (
      <button onClick={bump}>
        {foo} · {bar} · {String(baz)}
      </button>
    );
  }
`;

const ZustandCode = code /*tsx*/`
  import { createStore, useStore } from 'zustand';
  import React, { useState } from 'react';

  const makeStore = () => createStore(set => ({
    foo: 0, bar: 'hello', baz: true,
    bump: () => set(s => ({ foo: s.foo + 1 })),
  }));

  function useFooBarBaz() {
    const [store] = useState(makeStore);
    return useStore(store);
  }

  function Widget() {
    const { foo, bar, baz, bump } = useFooBarBaz();

    return (
      <button onClick={bump}>
        {foo} · {bar} · {String(baz)}
      </button>
    );
  }
`;

const JotaiCode = code /*tsx*/`
  import { atom, useAtom } from 'jotai';
  import React, { useMemo } from 'react';

  function useFooBarBaz() {
    const a = useMemo(() => ({
      foo: atom(0), bar: atom('hello'), baz: atom(true),
    }), []);

    const [foo, setFoo] = useAtom(a.foo);
    const [bar] = useAtom(a.bar);
    const [baz] = useAtom(a.baz);
    const bump = () => setFoo(f => f + 1);

    return { foo, bar, baz, bump };
  }

  function Widget() {
    const { foo, bar, baz, bump } = useFooBarBaz();

    return (
      <button onClick={bump}>
        {foo} · {bar} · {String(baz)}
      </button>
    );
  }
`;

const MobxCode = code /*tsx*/`
  import { makeAutoObservable } from 'mobx';
  import { observer } from 'mobx-react-lite';
  import React, { useState } from 'react';

  class FooBarBaz {
    foo = 0;
    bar = 'hello';
    baz = true;

    constructor() {
      makeAutoObservable(this);
    }

    bump() {
      this.foo++;
    }
  }

  const Widget = observer(() => {
    const [state] = useState(() => new FooBarBaz());

    return (
      <button onClick={() => state.bump()}>
        {state.foo} · {state.bar} · {String(state.baz)}
      </button>
    );
  });
`;

const ReduxCode = code /*tsx*/`
  import { configureStore, createSlice } from '@reduxjs/toolkit';
  import { Provider, useDispatch, useSelector } from 'react-redux';
  import React, { useState } from 'react';

  const slice = createSlice({
    name: 'fooBarBaz',
    initialState: { foo: 0, bar: 'hello', baz: true },
    reducers: {
      bump: (s) => { s.foo++; },
    },
  });

  function useFooBarBaz() {
    const { foo, bar, baz } = useSelector(s => s);
    const dispatch = useDispatch();
    const bump = () => dispatch(slice.actions.bump());

    return { foo, bar, baz, bump };
  }

  function App() {
    const [store] = useState(() =>
      configureStore({ reducer: slice.reducer }));

    return (
      <Provider store={store}>
        <Widget />
      </Provider>
    );
  }
`;
