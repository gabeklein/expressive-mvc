import { Model, Provider, get, set } from '@expressive/react';
import {
  Children,
  Fragment,
  ReactNode,
  cloneElement,
  isValidElement
} from 'react';

declare namespace Grid {
  interface Props {
    children?: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
  }

  interface BodyProps {
    header?: React.ReactNode;
    className?: string;
    children?: React.ReactNode;
    style?: React.CSSProperties;
  }

  interface RowProps<T = any> {
    data: T;
    i: number | string;
    children?: React.ReactNode;
    onClick?: (row: T) => void;
  }

  interface HeaderProps {
    children?: React.ReactNode;
  }

  interface HeadProps {
    column: Column;
    className?: string;
    children?: React.ReactNode;
  }

  interface CellProps<T = any> {
    column: Column;
    data: T;
    children?: React.ReactNode;
    className?: string;
  }

  type Cell<T = unknown> = React.FC<CellProps<T>>;
  type Row<T = unknown> = React.FC<RowProps<T>>;
  type Head = React.FC<HeadProps>;
  type Body = React.FC<BodyProps>;
}

abstract class Grid<T = any> extends Model {
  abstract Body: React.FC<Grid.BodyProps>;
  abstract Row: React.FC<Grid.RowProps<T>>;
  abstract Cell: React.FC<Grid.CellProps<T>>;
  abstract Head: React.FC<Grid.HeadProps>;

  before?: React.ReactNode = null;
  after?: React.ReactNode = null;

  end = false;

  data = [] as T[];
  columns = [] as Column[];
  error = null as string | null;

  onClick?: (row: T) => void = undefined;
  getMore?: () => Promise<void> = undefined;

  key(index: number): number {
    return index;
  }

  row(index: number) {
    return this.data[index];
  }

  cell(row: T, column: Column): ReactNode {
    const { id } = column;

    if (row && typeof row === 'object') return (row as any)[id];

    return null;
  }

  render(props: Grid.Props) {
    const { Body } = this;
    const { children, className, style } = props;

    if (children) this.columns = [];

    return (
      <Fragment>
        {Children.map(children, setKey)}
        <Body style={style} className={className} header={<IHeader />}>
          <IRows />
        </Body>
      </Fragment>
    );
  }

  Grid(props: Grid.Props) {
    return <Provider for={this}>{this.render(props)}</Provider>;
  }
}

class Column extends Model {
  grid = get(Grid);
  id = set(() => (this.name || '').toLowerCase());

  name: string | false = '';
  className = '';
  size?: string | number = 1;
  index: number = -1;

  Cell?: React.FC<Grid.CellProps> = undefined;
  Head?: React.FC<Grid.HeadProps> = undefined;

  children?: (row: any, key: number) => ReactNode = undefined;

  head() {
    return this.name;
  }

  render() {
    const { is } = this;
    this.index = is.grid.columns.push(is) - 1;
    return null;
  }
}

function setKey(child: React.ReactNode) {
  if (isValidElement(child) && child.key == null) {
    const props = child.props as any;
    return cloneElement(child, { key: props.id || props.name });
  }

  return child;
}

const IHeader = () =>
  Grid.get(({ columns, Head: Default }) =>
    columns.map(({ is: column, id, Head = Default, className }, i) => (
      <Head key={id || i} column={column} className={className}>
        {column.head()}
      </Head>
    ))
  );

const IRows = () => {
  const { key, data, is: grid, onClick, row } = Grid.get();

  return data.map((_, index) => {
    const i = key(index);
    const actualData = row(i);

    return (
      <grid.Row
        i={i}
        data={actualData}
        key={i}
        onClick={onClick && onClick.bind(grid, actualData)}>
        {grid.columns.map(({ Cell = grid.Cell, children, is }, cellIndex) => (
          <Cell
            className={is.className}
            column={is}
            data={actualData}
            key={is.id || cellIndex}>
            {children
              ? children(actualData, cellIndex)
              : grid.cell(actualData, is)}
          </Cell>
        ))}
      </grid.Row>
    );
  });
};

export { Grid, Column };
