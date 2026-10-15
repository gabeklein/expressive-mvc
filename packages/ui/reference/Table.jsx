import { format } from 'date-fns';

import { NotSpecified } from 'common/format';

import { Grid } from './Grid';

export class Table extends Grid {
  Body = Body;
  Row = Row;
  Cell = Cell;
  Head = Head;
}

/** @type {Grid.Body} */
export const Body = ({ children, className, header }) => {
  const { after, before, data } = Grid.get();

  outer: {
    radius: 8;
    border: 0xeee;
    overflow: hidden;
    backgroundColor: 0xffffff;
  }

  inner: {
    font: 13;
    height: fill;
    margin: 0, -1, -1;
    overflow: auto;
  }

  table: {
    borderCollapse: collapse;
    borderSpacing: 0;
    minWidth: fill;
  }

  thead: {
    padding: 0, 1.0;
    backgroundColor: 0xf3f4f6;
    zIndex: 1;
    position: sticky;
    top: 0;
  }

  return (
    <div _outer className={className}>
      <div _inner>
        {before}
        <table>
          <thead>
            <tr>{header}</tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
        {after}
        {data.length === 0 && <Empty />}
        <GetMore />
      </div>
    </div>
  );
};

export const Empty = () => {
  padding: 1.0;
  color: 0x9ca3af;
  fontSize: 14;
  width: '100%';
  boxSizing: borderBox;
  display: flex;
  alignItems: center;
  justifyContent: center;

  return <div>- No data yet -</div>;
};

/** @type {Grid.Head} */
export const Head = (props) => {
  padding: 1.0;
  textAlign: left;
  fontWeight: 500;
  color: 0x4b5563;
  overflow: hidden;
  textOverflow: ellipsis;
  whiteSpace: nowrap;
  backgroundColor: 0xf3f4f6;
  zIndex: 100;
  position: sticky;

  return <th {...props} />;
};

/** @type {Grid.Row} */
export const Row = ({ children, onClick }) => {
  borderBottom: 0xeeee;
  backgroundColor: 0xffffff;
  transition: 'background-color 0.2s';
  padding: 0, '1em';

  if (':hover') {
    backgroundColor: 0xf9fafb;
  }

  if (onClick) {
    cursor: pointer;
  }

  return <tr onClick={onClick}>{children}</tr>;
};

/** @type {Grid.Cell} */
export const Cell = ({ column, data, children, className }) => {
  td: {
    padding: '1em';
    color: 0x4b5563;
    borderTop: none;
    overflow: hidden;
    whiteSpace: nowrap;
    background: inherit;
  }

  if (children == null || children == '') {
    children = <NotSpecified />;
  }

  if (children instanceof Date) {
    children = format(children, 'MM/dd/yy');
  }

  return <td className={className}>{children}</td>;
};

const GetMore = () => {
  return Grid.get(({ end, data }) => {
    let getMore;

    if ('more' in data && typeof data.more === 'function') {
      const more = data.more;
      getMore = async () => void (await more());
    }

    if (!getMore || end) return false;

    let calledRef = false;

    /**
     * @param {HTMLDivElement | null} got
     */
    const ref = (got) => {
      const parent = got?.parentElement;

      if (!parent) return;

      const checkVisible = () => {
        if (calledRef) return;

        const endRect = got.getBoundingClientRect();
        const innerRect = parent.getBoundingClientRect();

        if (endRect.top - innerRect.bottom < 200) {
          calledRef = true;
          getMore();
        } else if (endRect.top - innerRect.bottom >= 100) {
          calledRef = false;
        }
      };

      parent.addEventListener('scroll', checkVisible);
      checkVisible();
    };

    return <div ref={ref} />;
  });
};
