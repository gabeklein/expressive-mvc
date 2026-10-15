/** @jsxRuntime classic */
/** @jsx createElement */
/** @jsxFrag Fragment */
import { Model } from '@expressive/mvc';
import { Fragment, createElement } from '@expressive/dom';

class Card extends Model {
  title = '';
}

export const classic = (
  <>
    <div className="x">
      <Card title="t" />
    </div>
    {/* @ts-expect-error */}
    <Card title={1} />
  </>
);
