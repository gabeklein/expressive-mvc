/** @jsxImportSource . */

import { expect, it } from '../vitest';

import { Component } from '.';
import { Fragment, jsxDEV } from './jsx-dev-runtime';

it('exports jsxDEV', () => {
  expect(jsxDEV).toBeDefined();
});

it('exports Fragment', () => {
  expect(Fragment).toBeDefined();
});

it('will convert Component to element', () => {
  class Test extends Component {
    render() {
      return null;
    }
  }

  const element = <Test>Hello</Test>;

  expect(element).toMatchObject({
    type: expect.any(Function),
    props: {
      children: 'Hello'
    }
  });
});
