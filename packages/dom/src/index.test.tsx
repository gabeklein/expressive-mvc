/** @jsxRuntime classic */
/** @jsx createElement */
/** @jsxFrag Fragment */
import { describe, expect, it } from 'vitest';

import { State } from '@expressive/mvc';
import { Fragment, createElement, render } from './index';
import { flushMicrotasks } from '../test.setup';

describe('classic JSX', () => {
  it('will render elements, fragments and State classes', async () => {
    class Card extends State {
      title = '';

      render() {
        return <b>{this.title}</b>;
      }
    }

    let card!: Card;
    const root = document.createElement('main');

    render(
      <>
        <i>one</i>
        <Card title="two" is={(value) => (card = value)} />
      </>,
      root
    );

    expect(root.textContent).toBe('onetwo');
    expect(root.querySelector('b')!.textContent).toBe('two');

    card.title = 'three';
    await flushMicrotasks();

    expect(root.textContent).toBe('onethree');
  });

  it('will type attributes like the automatic runtime', () => {
    class Card extends State {
      title = '';
    }

    void (() => [
      <Card title="t" />,
      <div className="x" />,
      // @ts-expect-error
      <Card title={1} />,
      // @ts-expect-error
      <div className={2} />
    ]);
  });
});
