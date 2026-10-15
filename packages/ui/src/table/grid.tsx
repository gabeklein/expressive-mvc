import { Component } from '@expressive/mvc';
import { Fragment, childrenOf, propsOf, typeOf } from '@expressive/mvc/runtime';

import { Column, type CellSlot, type Field, type HeadSlot } from './column';

declare namespace Grid {
  interface BodyProps {
    header: Component.Node;
    children: Component.Node;
    className?: string;
  }

  interface RowProps<T = any> {
    data: T;
    index: number;
    children: Component.Node;
    press?: () => void;
  }
}

/**
 * Headless table. Subclasses supply the four host slots; column resolution,
 * row/cell iteration and keying stay agnostic.
 *
 * Needs no intrinsic elements - output is entirely slots plus Fragment - so it
 * compiles without a host tag manifest. It also avoids `Grid.get()`: the static
 * consumer is adapter-declared, so an agnostic package cannot call it. Rows and
 * header are built inline instead, which costs granularity (a data change
 * re-renders the whole grid rather than one row).
 */
abstract class Grid<T = any> extends Component {
  abstract Body: (props: Grid.BodyProps) => Component.Node;
  abstract Row: (props: Grid.RowProps<T>) => Component.Node;
  abstract Cell: CellSlot<T>;
  abstract Head: HeadSlot<T>;

  data: T[] = [];
  fields: Field<T>[] = [];

  press?: (row: T, index: number) => void = undefined;

  /**
   * Stable identity per row. Named `rowKey` because `key` is reserved on
   * Component for the instance's own collection identity.
   */
  rowKey(row: T, index: number): string | number {
    return index;
  }

  /** Value for a cell, when a column declares no `children` renderer. */
  cell(row: T, field: Field<T>): Component.Node {
    return row && typeof row == 'object' ? (row as any)[field.id] : null;
  }

  render(props: { children?: Component.Node; className?: string }) {
    const { Body } = this;

    this.fields = resolve<T>(props.children);

    return (
      <Body className={props.className} header={this.header()}>
        {this.rows()}
      </Body>
    );
  }

  protected header(): Component.Node {
    const { fields, Head: Default } = this;

    return fields.map((field) => {
      const Slot = field.Head || Default;

      return (
        <Slot
          key={field.id || field.index}
          field={field}
          className={field.className}>
          {field.name}
        </Slot>
      );
    });
  }

  protected rows(): Component.Node {
    const { Cell: Default, Row, data, fields } = this;

    return data.map((row, index) => (
      <Row
        key={this.rowKey(row, index)}
        index={index}
        data={row}
        press={this.press && (() => this.press!(row, index))}>
        {fields.map((field) => {
          const Slot = field.Cell || Default;

          return (
            <Slot
              key={field.id || field.index}
              field={field}
              data={row}
              className={field.className}>
              {field.children
                ? field.children(row, index)
                : this.cell(row, field)}
            </Slot>
          );
        })}
      </Row>
    ));
  }
}

/** Read Column elements out of a Grid's children into resolved fields. */
function resolve<T>(children: Component.Node): Field<T>[] {
  const fields: Field<T>[] = [];

  for (const node of flatten(children)) {
    const type = typeOf(node);

    if (typeof type != 'function' || !(type.prototype instanceof Column))
      continue;

    const props = propsOf(node) as Partial<Field<T>>;
    const name = props.name ?? '';

    fields.push({
      name,
      id: props.id || (typeof name == 'string' ? name.toLowerCase() : ''),
      className: props.className || '',
      size: props.size,
      index: fields.length,
      Cell: props.Cell,
      Head: props.Head,
      children: props.children
    });
  }

  return fields;
}

function flatten(children: Component.Node): Component.Node[] {
  const out: Component.Node[] = [];

  for (const node of childrenOf(children))
    if (typeOf(node) === Fragment)
      out.push(...flatten((propsOf(node) as any).children));
    else out.push(node);

  return out;
}

export { Grid };
