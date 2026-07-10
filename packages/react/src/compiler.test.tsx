import { transformSync } from '@babel/core';
// @ts-ignore - babel plugin ships no type declarations
import reactCompiler from 'babel-plugin-react-compiler';
// @ts-ignore - babel preset ships no type declarations
import presetReact from '@babel/preset-react';
// @ts-ignore - babel plugin ships no type declarations
import commonjs from '@babel/plugin-transform-modules-commonjs';

import { describe, expect, it } from 'bun:test';
import { act, render } from '@testing-library/react';

import * as Expressive from '.';
import * as React from 'react';
import * as ReactJSX from 'react/jsx-runtime';
import * as CompilerRuntime from 'react/compiler-runtime';
import { State, Provider } from '.';
import { mockWarn } from '../test.setup';

/** Let the guard's macrotask (setTimeout) fire so its warning can land. */
const flushTimers = () => new Promise((resolve) => setTimeout(resolve, 10));

const registry: Record<string, unknown> = {
  '@expressive/react': Expressive,
  react: React,
  'react/jsx-runtime': ReactJSX,
  'react/compiler-runtime': CompilerRuntime
};

/**
 * Compile a fixture through babel-plugin-react-compiler exactly as a consumer's
 * build would, then evaluate it against the real React and @expressive/react
 * modules already loaded in this process. Returns the fixture's exports.
 *
 * Asserts the compiler behaved as the test expects - memoized by default, or
 * opted out when `memoized` is false - so a silent bail-out (or a directive
 * that failed to take effect) can never let these tests pass by accident.
 */
function compile(source: string, memoized = true) {
  const { code } = transformSync(source, {
    filename: 'fixture.tsx',
    babelrc: false,
    configFile: false,
    presets: [[presetReact, { runtime: 'automatic' }]],
    plugins: [[reactCompiler, { target: '19' }], commonjs]
  })!;

  if (/compiler-runtime/.test(code!) !== memoized)
    throw new Error(
      `Expected fixture ${memoized ? 'to be' : 'not to be'} memoized:\n` + code
    );

  const module = { exports: {} as any };
  const require = (id: string) => {
    if (id in registry) return registry[id];
    throw new Error(`Fixture required unexpected module: ${id}`);
  };

  new Function('exports', 'require', 'module', code!)(
    module.exports,
    require,
    module
  );

  return module.exports;
}

class Counter extends State {
  count = 0;
  inc() {
    this.count++;
  }
}

describe('harness', () => {
  it('will memoize a plain component', () => {
    const { App } = compile(`
      export function App({ label }) {
        return <button>{label}</button>;
      }
    `);

    const { container } = render(<App label="hello" />);
    expect(container.textContent).toBe('hello');
  });
});

describe('Component', () => {
  it('will stay reactive when rendered from a compiled tree', async () => {
    const warn = mockWarn();
    const { App } = compile(`
      import { Component } from '@expressive/react';
      class Counter extends Component {
        count = 0;
        inc() { this.count++; }
        render() {
          return <button onClick={this.inc}>{this.count}</button>;
        }
      }
      export function App() {
        return <Counter />;
      }
    `);

    const { container, getByRole } = render(<App />);

    expect(container.textContent).toBe('0');

    await act(async () => {
      getByRole('button').click();
    });

    expect(container.textContent).toBe('1');

    await flushTimers();
    expect(warn).not.toHaveBeenCalled();
  });
});

// The compiler memoizes these hook calls on their reference-stable arguments,
// so the hook runs only at mount and later updates are dropped. `use no memo`
// opts the component out and restores reactivity.
describe('use()', () => {
  it('will not re-render without opt-out (documents react-compiler limitation)', async () => {
    const warn = mockWarn();
    const { View } = compile(`
      import { use } from '@expressive/react';
      export function View({ model }) {
        const { count } = use(model);
        return <p>{count}</p>;
      }
    `);

    const model = Counter.new();
    const { container } = render(<View model={model} />);

    expect(container.textContent).toBe('0');

    await act(async () => {
      model.count++;
    });

    expect(container.textContent).toBe('0');

    await flushTimers();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('did not re-render')
    );
  });

  it('will re-render with "use no memo"', async () => {
    const warn = mockWarn();
    const { View } = compile(`
      import { use } from '@expressive/react';
      export function View({ model }) {
        "use no memo";
        const { count } = use(model);
        return <p>{count}</p>;
      }
    `, false);

    const model = Counter.new();
    const { container } = render(<View model={model} />);

    expect(container.textContent).toBe('0');

    await act(async () => {
      model.count++;
    });

    expect(container.textContent).toBe('1');

    await flushTimers();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('State.use()', () => {
  it('will not re-render without opt-out (documents react-compiler limitation)', async () => {
    const warn = mockWarn();
    const { View } = compile(`
      export function View({ Model }) {
        const { count, inc } = Model.use();
        return <button onClick={inc}>{count}</button>;
      }
    `);

    const { container, getByRole } = render(<View Model={Counter} />);

    expect(container.textContent).toBe('0');

    await act(async () => {
      getByRole('button').click();
    });

    expect(container.textContent).toBe('0');

    await flushTimers();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('did not re-render')
    );
  });

  it('will re-render with "use no memo"', async () => {
    const warn = mockWarn();
    const { View } = compile(`
      export function View({ Model }) {
        "use no memo";
        const { count, inc } = Model.use();
        return <button onClick={inc}>{count}</button>;
      }
    `, false);

    const { container, getByRole } = render(<View Model={Counter} />);

    expect(container.textContent).toBe('0');

    await act(async () => {
      getByRole('button').click();
    });

    expect(container.textContent).toBe('1');

    await flushTimers();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('State.get()', () => {
  it('will not re-render without opt-out (documents react-compiler limitation)', async () => {
    const warn = mockWarn();
    const { View } = compile(`
      export function View({ Model }) {
        const { count } = Model.get();
        return <p>{count}</p>;
      }
    `);

    const model = Counter.new();
    const { container } = render(
      <Provider for={model}>
        <View Model={Counter} />
      </Provider>
    );

    expect(container.textContent).toBe('0');

    await act(async () => {
      model.count++;
    });

    expect(container.textContent).toBe('0');

    await flushTimers();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('did not re-render')
    );
  });

  it('will re-render with "use no memo"', async () => {
    const warn = mockWarn();
    const { View } = compile(`
      export function View({ Model }) {
        "use no memo";
        const { count } = Model.get();
        return <p>{count}</p>;
      }
    `, false);

    const model = Counter.new();
    const { container } = render(
      <Provider for={model}>
        <View Model={Counter} />
      </Provider>
    );

    expect(container.textContent).toBe('0');

    await act(async () => {
      model.count++;
    });

    expect(container.textContent).toBe('1');

    await flushTimers();
    expect(warn).not.toHaveBeenCalled();
  });
});
