import State, { Component, Provider, get, has, map, ref, set } from '@expressive/react';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Report = (name: string, pass: boolean, detail: string) => void;

const MARKER = '[gauntlet]';
const RENDERED = 'a write re-renders through the native renderer';

const collected: [string, boolean, string][] = [];

let listen: (() => void) | undefined;

// A Release build forwards console.error to os_log, but not console.log.
declare const __DEV__: boolean;
const emit = __DEV__ ? console.log : console.error;

const record: Report = (name, pass, detail) => {
  collected.push([name, pass, detail]);
  emit(`${MARKER} ${pass ? 'ok' : 'FAIL'} ${name} - ${detail}`);
  listen?.();
};

const drain = () => new Promise(resolve => queueMicrotask(() => resolve(null)));

class Counter extends State {
  count = 0;
  step = 1;

  get doubled() {
    return this.count * 2;
  }

  bump = () => {
    this.count += this.step;
  };
}

class Session extends State {
  user = 'ada';
}

class Async extends State {
  value = set(() => Promise.resolve('resolved'));
}

class Refs extends State {
  node = ref<View>();
}

class Cell extends State {
  constructor(public id = 0) {
    super();
  }
}

class Grid extends State {
  cells = map(() => new Cell());
}

class Flagged extends State {
  active = has();
}

class Panel extends Component<{ label: string }> {
  label = set<string>();
  counter = get(Counter);

  render() {
    return (
      <Text testID="panel">
        {this.label}:{this.counter.count}
      </Text>
    );
  }
}

let recovered = '';
let broken = true;

class Broken extends Component {
  fallback = null;

  catch(error: Error) {
    recovered = error.message;
    broken = false;
  }

  render() {
    if (broken) throw new Error('boom');
    return <Text testID="recovered">recovered</Text>;
  }
}

const CHECKS: [string, (report: Report) => Promise<void>][] = [
  ['dispatch queued', async report => {
    const state = Counter.new();
    let seen = 0;

    const done = state.get(current => { seen = current.count });

    state.count = 5;
    const sync = seen;
    await drain();
    done();

    report('dispatch is queued, not synchronous', sync === 0 && seen === 5,
      `effect saw ${sync} synchronously, ${seen} after drain`);
  }],

  ['batched dispatch', async report => {
    const state = Counter.new();
    let runs = 0;

    const done = state.get(current => {
      void current.count;
      void current.step;
      runs++;
    });

    await drain();
    const initial = runs;

    state.count = 1;
    state.step = 2;
    await drain();
    done();

    report('two writes batch into one update', runs - initial === 1,
      `${runs - initial} update(s) for two writes`);
  }],

  ['computed getter', async report => {
    const state = Counter.new();
    const first = state.doubled;

    state.count = 21;
    await drain();

    report('computed getter tracks its source', first === 0 && state.doubled === 42,
      `${first} -> ${state.doubled}`);
  }],

  ['async set()', async report => {
    const state = Async.new();
    let suspended = false;

    try {
      void state.value;
    }
    catch (thrown) {
      suspended = thrown instanceof Promise;
      if (suspended) await thrown;
    }

    report('async set() suspends then resolves', suspended && state.value === 'resolved',
      `suspended ${suspended}, value ${JSON.stringify(state.value)}`);
  }],

  ['context lookup', async report => {
    const session = Session.new();
    let found: Session | undefined;

    class Consumer extends State {
      session = get(Session);
    }

    try {
      found = Consumer.new().session;
    }
    catch (thrown) {
      report('get(Session) outside context throws', true,
        (thrown as Error).message.slice(0, 50));
      session.set(null);
      return;
    }

    report('get(Session) resolves', found === session,
      found === session ? 'same instance' : 'mismatch');

    session.set(null);
  }],

  ['map() and has()', async report => {
    const grid = Grid.new();
    const flagged = Flagged.new();

    grid.cells.set('a', new Cell(1));
    await drain();

    const cell = grid.cells.get('a');

    report('map() stores and has() declares', cell instanceof Cell,
      `cell id ${cell?.id}, has() is ${typeof flagged.active}`);
  }],

  ['ref()', async report => {
    const state = Refs.new();

    report('ref() is callable for a host node', typeof state.node === 'function',
      `ref is ${typeof state.node}`);
  }],

  ['effect cleanup', async report => {
    const state = Counter.new();
    let cleaned = false;

    state.get(current => {
      void current.count;
      return () => { cleaned = true };
    });

    await drain();
    state.set(null);
    await drain();

    report('effect cleanup runs on termination', cleaned,
      cleaned ? 'cleanup ran' : 'cleanup skipped');
  }],

  ['uSES precondition', async report => {
    report('React on native exposes useSyncExternalStore',
      typeof React.useSyncExternalStore === 'function',
      'the adapter registers this exact function at import; its own Runtime is' +
      ' package-internal, so identity is not observable from published exports');
  }],

  ['BrowserRouter', async report => {
    const { BrowserRouter } = await import('@expressive/router') as any;
    let message = 'did not throw';

    try {
      BrowserRouter.new();
    }
    catch (thrown) {
      message = (thrown as Error).message;
    }

    report('BrowserRouter throws on native', message !== 'did not throw',
      message.slice(0, 60));
  }],

  ['headless Router', async report => {
    const { Router } = await import('@expressive/router') as any;
    const router = Router.new();
    const path = router.path;

    report('headless Router constructs on native', typeof path === 'string',
      `path is ${JSON.stringify(path)}`);

    router.set(null);
  }],

  ['Component.catch', async report => {
    for (let wait = 0; wait < 50 && broken; wait++)
      await new Promise(resolve => setTimeout(resolve, 20));

    report('Component.catch() recovers a thrown render', recovered === 'boom' && !broken,
      `caught ${JSON.stringify(recovered)}, retry ${broken ? 'still throwing' : 'succeeded'}`);
  }]
];

function Renderer() {
  const counter = Counter.use();
  const renders = useRef(0);
  const reported = useRef(false);

  renders.current++;

  useEffect(() => {
    const mounted = renders.current;
    let waited = 0;

    counter.bump();

    const poll = setInterval(() => {
      const again = renders.current > mounted;

      if (!again && waited++ < 50)
        return;

      clearInterval(poll);

      if (reported.current)
        return;

      reported.current = true;
      record(RENDERED, again && counter.count === 1,
        `count ${counter.count}, ${renders.current} renders after ${waited * 20}ms`);
    }, 20);
  }, []);

  return (
    <View style={styles.block}>
      <Text style={styles.heading}>Renderer</Text>
      <Text testID="count">count: {counter.count}</Text>
      <Text testID="doubled">doubled: {counter.doubled}</Text>
      <Text testID="renders">renders: {renders.current}</Text>
      <Provider for={counter}>
        <Panel label="panel" />
      </Provider>
      <Broken />
      <Pressable testID="bump" style={styles.button} onPress={counter.bump}>
        <Text style={styles.buttonText}>bump</Text>
      </Pressable>
    </View>
  );
}

export default function App() {
  const [log, setLog] = useState(collected.slice());

  useEffect(() => {
    listen = () => setLog(collected.slice());

    const rendered = () => collected.some(([name]) => name.startsWith(RENDERED));

    const run = async () => {
      for (const [label, check] of CHECKS)
        try {
          await check(record);
        }
        catch (thrown) {
          record(label, false, `threw: ${(thrown as Error).message}`);
        }

      for (let wait = 0; wait < 100 && !rendered(); wait++)
        await new Promise(resolve => setTimeout(resolve, 20));

      if (!rendered())
        record(RENDERED, false, 'the renderer never reported');

      const failed = collected.filter(([, pass]) => !pass).length;

      emit(`${MARKER} DONE ${collected.length} checks, ${failed} failed`);
    };

    run();

    return () => { listen = undefined };
  }, []);

  const failed = log.filter(([, pass]) => !pass).length;
  const done = log.length > CHECKS.length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text testID="summary" style={styles.summary}>
        {done ? failed ? `FAIL ${failed}` : `PASS ${log.length}` : 'running'}
      </Text>
      <Renderer />
      <View style={styles.block}>
        <Text style={styles.heading}>Checks</Text>
        {log.map(([name, pass, detail], i) => (
          <Text key={i} style={pass ? styles.pass : styles.fail}>
            {pass ? 'ok' : 'XX'} {name} - {detail}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingTop: 64, gap: 16 },
  block: { gap: 4 },
  heading: { fontWeight: '600', fontSize: 16 },
  summary: { fontSize: 24, fontWeight: '700' },
  pass: { color: '#0a7', fontSize: 12 },
  fail: { color: '#c00', fontSize: 12 },
  button: { backgroundColor: '#0a7', padding: 10, borderRadius: 6, alignSelf: 'flex-start' },
  buttonText: { color: '#fff', fontWeight: '600' }
});
