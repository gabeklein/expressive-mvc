import './App.css';

import State, { Component, get, map } from '@expressive/react';

const COLS = ['A', 'B', 'C', 'D'];
const ROWS = [1, 2, 3, 4, 5];

// The sheet owns the cells, keyed by coordinate, and spawns them lazily on
// first edit - an empty coordinate simply has no member yet. Its own render
// is static; each cell view subscribes to its own key and repaints alone.
export default class Sheet extends Component {
  cells = map(() => new Cell());
  editing = '';

  edit(id: string, input: string) {
    if (!this.cells.has(id)) this.cells.set(id);
    this.cells.get(id)!.input = input;
  }

  render() {
    return (
      <div className="container sheet">
        <h1>Spreadsheet</h1>
        <p>
          Enter a number, text, or a formula like <code>=A1*2+B1</code>.
          Editing a cell recomputes only the cells that reference it.
        </p>

        <table>
          <thead>
            <tr>
              <th />
              {COLS.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r}>
                <th>{r}</th>
                {COLS.map((c) => (
                  <CellView key={c + r} id={c + r} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
}

// A cell is a spawned, owned member of the sheet's map - the sparse data,
// one per *filled* coordinate. Its value is a computed getter: a formula
// substitutes each referenced cell's value (read through the map by key,
// which subscribes to that key alone) and evaluates the arithmetic - so a
// cell recomputes only when a cell it references changes, and it cascades.
class Cell extends State {
  sheet = get(Sheet);
  input = '';

  get value(): number | string {
    const raw = this.input.trim();

    if (!raw) return '';

    if (!raw.startsWith('=')) {
      const n = Number(raw);
      return isNaN(n) ? raw : n;
    }

    // Replace A1-style refs with their numeric value, then evaluate the
    // remaining arithmetic (+ - * / and parens). The substituted string is
    // digits and operators only, checked before it runs.
    const expr = raw.slice(1).replace(/[A-Za-z]+\d+/g, (ref) => {
      const cell = this.sheet.cells.get(ref.toUpperCase()); // subscribes
      const val = cell ? cell.value : 0;
      return typeof val === 'number' && isFinite(val) ? String(val) : '0';
    });

    if (!/^[\d+\-*/(). ]+$/.test(expr)) return '#ERR';

    try {
      const result = Function(`"use strict"; return (${expr})`)();
      if (typeof result !== 'number' || !isFinite(result)) return '#ERR';
      return Math.round(result * 1e4) / 1e4;
    } catch {
      return '#ERR';
    }
  }
}

// One <td> per coordinate - the dense view, one per *slot*. It holds no
// state, so it is a plain function component: Sheet.get() finds the sheet
// from context and subscribes to just this coordinate's cell - absent until
// first edit, then filled in. A keyed read that tracks a key before it
// exists and repaints only when its own cell changes.
const CellView = ({ id }: { id: string }) => {
  const sheet = Sheet.get();
  const cell = sheet.cells.get(id);

  return (
    <td>
      {sheet.editing === id ? (
        <input
          autoFocus
          value={cell ? cell.input : ''}
          onChange={(e) => sheet.edit(id, e.target.value)}
          onBlur={() => (sheet.editing = '')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') sheet.editing = '';
          }}
        />
      ) : (
        <div className="cell" onClick={() => (sheet.editing = id)}>
          {cell ? cell.value : ''}
        </div>
      )}
    </td>
  )
};
