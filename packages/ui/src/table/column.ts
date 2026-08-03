import { Component } from '@expressive/mvc';

interface CellProps<T = any> {
  field: Field<T>;
  data: T;
  className?: string;
  children?: Component.Node;
}

interface HeadProps<T = any> {
  field: Field<T>;
  className?: string;
  children?: Component.Node;
}

type CellSlot<T = any> = (props: CellProps<T>) => Component.Node;
type HeadSlot<T = any> = (props: HeadProps<T>) => Component.Node;

/**
 * Declares a column. Never mounts - the enclosing Grid reads it from its own
 * children, so a column contributes no output and needs no context round-trip.
 */
class Column<T = any> extends Component {
  name: string | false = '';
  id = '';
  className = '';
  size?: string | number = 1;

  Cell?: CellSlot<T> = undefined;
  Head?: HeadSlot<T> = undefined;

  /** Per-row content. Falls back to the Grid's `cell` lookup. */
  children?: (row: T, index: number) => Component.Node = undefined;

  render(): Component.Node {
    return null;
  }
}

/** Resolved column, after a Grid reads a Column element's props. */
interface Field<T = any> {
  id: string;
  name: string | false;
  className: string;
  size?: string | number;
  index: number;
  Cell?: CellSlot<T>;
  Head?: HeadSlot<T>;
  children?: (row: T, index: number) => Component.Node;
}

export { Column };
export type { CellProps, HeadProps, CellSlot, HeadSlot, Field };
