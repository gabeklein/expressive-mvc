import { describe, expect, it } from 'vitest';

import { Component } from '@expressive/mvc';
import { mockWarn, place } from '../../test.setup';
import { style } from '../index';
import { unmatched } from './diagnose';

const warn = mockWarn();

describe('unmatched flags', () => {
  it('will not warn outside the dev runtime', () => {
    unmatched({ _quiet: true }, [], undefined);

    expect(warn).not.toHaveBeenCalled();
  });

  it('will warn once for a flag with no rule', () => {
    function Card() {
      return <><section _raisd /><section _raisd /></>;
    }

    style(Card, { _raised: { color: 'red' } });

    place(<Card />);
    place(<Card />);

    expect(warn.mock.calls).toEqual([['"_raisd" matches no rule in Card. Did you mean "_raised"?']]);
  });

  it('will name a component with no style()', () => {
    function Bare() {
      return <p _note />;
    }

    place(<Bare />);

    expect(warn.mock.calls).toEqual([['"_note" matches no rule - Bare has no style().']]);
  });

  it('will warn for a flag written outside any component', () => {
    place(<p _loose />);

    expect(warn.mock.calls).toEqual([['"_loose" matches no rule.']]);
  });

  it('will warn for a flag no caller or callee rule matches', () => {
    function Button(props: object) {
      return <button {...props} />;
    }

    function Toolbar() {
      return <nav><Button _primray /></nav>;
    }

    style(Button, { _primary: { color: 'blue' } });
    style(Toolbar, { color: 'gray' });

    place(<Toolbar />);

    expect(warn.mock.calls).toEqual([['"_primray" matches no rule in Toolbar. Did you mean "_primary"?']]);
  });

  it('will name a subcomponent', () => {
    class Menu extends Component {
      Title() {
        return <b _bold />;
      }

      render() {
        return <this.Title />;
      }
    }

    style(Menu, { _Title: { color: 'red' } });

    place(<Menu />);

    expect(warn.mock.calls).toEqual([['"_bold" matches no rule in Title.']]);
  });

  it('will not warn for a matched, tag or forwarded flag', () => {
    function Button(props: object) {
      return <button {...props} />;
    }

    function Toolbar() {
      return <nav _nav><Button _primary /><Button _accent /><i _i /></nav>;
    }

    style(Button, { _primary: { color: 'blue' } });
    style(Toolbar, { _nav: { color: 'gray' }, _accent: { color: 'red' } });

    place(<Toolbar />);

    expect(warn).not.toHaveBeenCalled();
  });

  it('will not warn for a flag a component declares', () => {
    class Badge extends Component {
      _accent = false;

      render() {
        return <span>{String(this._accent)}</span>;
      }
    }

    function Card() {
      return <Badge _accent />;
    }

    place(<Card />);

    expect(warn).not.toHaveBeenCalled();
  });
});
