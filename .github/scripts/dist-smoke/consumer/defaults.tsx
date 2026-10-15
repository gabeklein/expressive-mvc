/** @jsxRuntime classic */
import * as React from '@expressive/dom';
import { Model } from '@expressive/mvc';

class Card extends Model {
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
