import { describe, expect, it, mock } from 'bun:test';

import { childrenOf, Fragment, host, isElement, jsx, jsxs, propsOf, typeOf } from './jsx-runtime';
import { jsxDEV, Fragment as devFragment } from './jsx-dev-runtime';
import type { HostRuntime } from './jsx-runtime';

const HOST_FRAGMENT = Symbol('host.Fragment');

function mockHost(overrides?: Partial<HostRuntime>): HostRuntime {
  return {
    jsx: mock((type, props, key) => ({ kind: 'jsx', type, props, key })),
    jsxs: mock((type, props, key) => ({ kind: 'jsxs', type, props, key })),
    Fragment: HOST_FRAGMENT,
    childrenOf: mock((children) => [children]),
    isElement: mock((node) => !!node),
    typeOf: mock((node: any) => node.type),
    propsOf: mock((node: any) => node.props),
    ...overrides
  };
}

const runtime = mockHost();

describe('unregistered', () => {
  const noHost = 'No JSX host is registered for @expressive/mvc.';

  // Ordering matters: these run before any host() call in this module,
  // and no other test file touches the jsx module.
  it('will throw on element creation', () => {
    expect(() => jsx('div', {})).toThrow(noHost);
  });

  it('will throw on introspection', () => {
    const noHost = /No JSX host/;
    expect(() => childrenOf([])).toThrow(noHost);
    expect(() => isElement({})).toThrow(noHost);
    expect(() => typeOf({})).toThrow(noHost);
    expect(() => propsOf({})).toThrow(noHost);
  });
});

describe('registration', () => {
  it('will register a host', () => {
    host(runtime);
    expect(jsx('div', { a: 1 }, 'k')).toEqual({
      kind: 'jsx', type: 'div', props: { a: 1 }, key: 'k'
    });
  });

  it('will accept same host again', () => {
    expect(() => host(runtime)).not.toThrow();
  });

  it('will throw on conflicting host', () => {
    expect(() => host(mockHost())).toThrow(
      'A different JSX host is already registered'
    );
  });
});

describe('runtime', () => {
  it('will delegate jsxs', () => {
    expect(jsxs('ul', { children: [] })).toEqual({
      kind: 'jsxs', type: 'ul', props: { children: [] }, key: undefined
    });
  });

  it('will translate Fragment to host Fragment', () => {
    expect(devFragment).toBe(Fragment);
    expect((jsx(Fragment, {}) as any).type).toBe(HOST_FRAGMENT);
    expect((jsxs(Fragment, {}) as any).type).toBe(HOST_FRAGMENT);
    expect((jsxDEV(Fragment, {}) as any).type).toBe(HOST_FRAGMENT);
  });

  it('will fall back to jsx when host lacks jsxDEV', () => {
    expect(jsxDEV('div', {}, 'k', false)).toEqual({
      kind: 'jsx', type: 'div', props: {}, key: 'k'
    });
    expect(jsxDEV('div', {}, 'k', true)).toEqual({
      kind: 'jsxs', type: 'div', props: {}, key: 'k'
    });
  });

  it('will delegate jsxDEV when host provides it', () => {
    // the registered host is ours - giving it a dev runtime is not a re-registration
    runtime.jsxDEV = mock((type, props, key, isStatic) => ({
      kind: 'jsxDEV', type, props, key, isStatic
    }) as any);

    expect(jsxDEV('div', {}, 'k', true)).toEqual({
      kind: 'jsxDEV', type: 'div', props: {}, key: 'k', isStatic: true
    } as any);
  });
});

describe('introspection', () => {
  it('will delegate to host', () => {
    expect(childrenOf('x')).toEqual(['x']);
    expect(isElement(0)).toBe(false);
    expect(isElement({})).toBe(true);
    expect(typeOf({ type: 'div' })).toBe('div');
    expect(propsOf({ props: { to: '/' } })).toEqual({ to: '/' });
  });

  it('will surface host Fragment as agnostic Fragment', () => {
    expect(typeOf({ type: HOST_FRAGMENT })).toBe(Fragment);
  });
});
