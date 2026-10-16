import { Component } from '@expressive/mvc';
import { Fragment, host } from '@expressive/mvc/jsx-runtime';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { Column as ColumnClass, type CellProps, type Field, type HeadProps } from './column';
import { Grid } from './grid';

interface Element {
  type: any;
  props: any;
  key?: any;
}

const element = (type: unknown, props: object, key?: unknown) =>
  ({ type, props, key }) as Element;

function childrenOf(children: unknown): unknown[] {
  if (Array.isArray(children)) return children.flatMap(childrenOf);
  if (children == null || typeof children == 'boolean') return [];
  return [children];
}

beforeAll(() => {
  host({
    jsx: element,
    jsxs: element,
    Fragment,
    childrenOf,
    isElement: (node) => !!node && typeof node == 'object' && 'type' in node,
    typeOf: (node: any) => node && node.type,
    propsOf: (node: any) => node.props
  });
});

const Column = ColumnClass as unknown as (props: Partial<Omit<Field, 'index'>>) => null;

interface Row {
  name: string;
  age: number;
}

const Body = (props: Grid.BodyProps) => props.children;
const RowSlot = (props: Grid.RowProps<Row>) => props.children;
const Cell = (props: CellProps) => props.children;
const Head = (props: HeadProps) => props.children;

class Table extends Grid<Row> {
  Body = Body;
  Row = RowSlot;
  Cell = Cell;
  Head = Head;
}

const DATA: Row[] = [
  { name: 'Ann', age: 30 },
  { name: 'Bob', age: 40 }
];

function render(grid: Grid<any>, children: Component.Node, className?: string) {
  const body = grid.render({ children, className }) as Element;
  const header = body.props.header as Element[];
  const rows = body.props.children as Element[];

  return { body, header, rows };
}

describe('columns', () => {
  it('will resolve fields from Column children', () => {
    const table = Table.new({ data: DATA });

    render(
      table,
      <>
        <Column name="Name" />
        <Column name="Years" id="age" className="num" size={2} />
      </>
    );

    expect(table.fields).toEqual([
      expect.objectContaining({ name: 'Name', id: 'name', className: '', index: 0, size: undefined }),
      expect.objectContaining({ name: 'Years', id: 'age', className: 'num', index: 1, size: 2 })
    ]);
  });

  it('will ignore non-column children', () => {
    const table = Table.new();
    const Other = () => null;

    render(table, [
      'text',
      <Other />,
      <>
        <Column name="Name" />
      </>
    ]);

    expect(table.fields.map((field) => field.id)).toEqual(['name']);
  });

  it('will default name and id', () => {
    const table = Table.new();

    render(table, [<Column />, <Column name={false} />]);

    expect(table.fields).toEqual([
      expect.objectContaining({ name: '', id: '' }),
      expect.objectContaining({ name: false, id: '' })
    ]);
  });
});

describe('header', () => {
  it('will render a Head slot per field', () => {
    const table = Table.new();
    const { body, header } = render(table, <Column name="Name" className="a" />, 'grid');

    expect(body.type).toBe(Body);
    expect(body.props.className).toBe('grid');
    expect(header).toEqual([
      {
        type: Head,
        key: 'name',
        props: { field: table.fields[0], className: 'a', children: 'Name' }
      }
    ]);
  });

  it('will prefer a column Head slot', () => {
    const Custom = (props: HeadProps) => props.children;
    const { header } = render(Table.new(), [<Column Head={Custom} />, <Column name={false} />]);

    expect(header.map((head) => head.type)).toEqual([Custom, Head]);
    expect(header.map((head) => head.key)).toEqual([0, 1]);
  });
});

describe('rows', () => {
  it('will render a Row per datum keyed by index', () => {
    const { rows } = render(Table.new({ data: DATA }), <Column name="Name" />);

    expect(rows.map((row) => row.type)).toEqual([RowSlot, RowSlot]);
    expect(rows.map((row) => row.key)).toEqual([0, 1]);
    expect(rows[1].props).toMatchObject({ data: DATA[1], index: 1, press: undefined });
  });

  it('will key rows by rowKey', () => {
    class Keyed extends Table {
      rowKey(row: Row) {
        return row.name;
      }
    }

    const { rows } = render(Keyed.new({ data: DATA }), <Column name="Name" />);

    expect(rows.map((row) => row.key)).toEqual(['Ann', 'Bob']);
  });

  it('will bind press to row', () => {
    const press = vi.fn();
    const { rows } = render(Table.new({ data: DATA, press }), <Column name="Name" />);

    rows[1].props.press();

    expect(press).toHaveBeenCalledWith(DATA[1], 1);
  });

  it('will render cells by field lookup', () => {
    const { rows } = render(
      Table.new({ data: DATA }),
      [<Column name="Name" />, <Column name="Age" className="num" />]
    );

    const [ann] = rows;

    expect(ann.props.children).toEqual([
      { type: Cell, key: 'name', props: expect.objectContaining({ data: DATA[0], className: '', children: 'Ann' }) },
      { type: Cell, key: 'age', props: expect.objectContaining({ className: 'num', children: 30 }) }
    ]);
  });

  it('will prefer column renderer and Cell slot', () => {
    const Custom = (props: CellProps) => props.children;
    const { rows } = render(
      Table.new({ data: DATA }),
      <Column name="Name" Cell={Custom}>
        {(row: Row, index: number) => `${index}:${row.name}`}
      </Column>
    );

    expect(rows[1].props.children[0]).toMatchObject({
      type: Custom,
      props: { children: '1:Bob' }
    });
  });

  it('will render no value for a non-object row', () => {
    const { rows } = render(Table.new({ data: [null, 1] as any }), <Column />);
    const cells = rows.map((row) => row.props.children[0]);

    expect(cells.map((cell) => cell.key)).toEqual([0, 0]);
    expect(cells.map((cell) => cell.props.children)).toEqual([null, null]);
  });
});
