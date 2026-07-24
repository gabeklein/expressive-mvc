import './App.css';

import { Component } from '@expressive/react';

// Beyond single values: a getter is a *computed* property. It tracks
// whatever it reads and recomputes only when those inputs change - no
// useMemo, no dependency array. Getters may even read other getters.
class TipCalculator extends Component {
  bill = 50;
  tipPercent = 18;

  get tip() {
    return (this.bill * this.tipPercent) / 100;
  }

  get total() {
    return this.bill + this.tip; // depends on another computed
  }

  render() {
    const { bill, tipPercent, tip, total } = this;

    return (
      <div className="container">
        <h1>Computed</h1>

        <label>
          Bill
          <input
            type="number"
            value={bill}
            onChange={(e) => (this.bill = +e.target.value)}
          />
        </label>

        <label>
          Tip: {tipPercent}%
          <input
            type="range"
            min={0}
            max={30}
            value={tipPercent}
            onChange={(e) => (this.tipPercent = +e.target.value)}
          />
        </label>

        {/* tip and total recompute on their own when either input changes */}
        <p className="result">
          Tip <b>${tip.toFixed(2)}</b> · Total <b>${total.toFixed(2)}</b>
        </p>
      </div>
    );
  }
}

// You could export TipCalculator directly too.
// It's renderable like any other component.
export default () => <TipCalculator />;
