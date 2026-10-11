/** @jsxRuntime classic */
import * as React from '@expressive/dom';
import { State } from '@expressive/mvc';

class Card extends State {
  title = '';
}

export const defaults = (
  <>
    <Card title="t" />
    {/* @ts-expect-error */}
    <Card title={1} />
  </>
);

void React;
