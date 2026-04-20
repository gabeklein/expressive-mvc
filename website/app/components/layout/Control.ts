import State, { Component, get, ref, set } from '@expressive/react';
import React, { type MouseEventHandler, type ReactNode } from 'react';

const AXIS = ['gridTemplateRows', 'gridTemplateColumns'] as const;

export interface HandleProps {
  grab: MouseEventHandler;
  pull?: MouseEventHandler;
  push?: MouseEventHandler;
  vertical?: boolean;
  width?: number;
}

export class Control extends Component {
  static managed = new WeakSet();

  container = ref(this.applyLayout);

  parent = get(Control, false);
  output = set(this.getOutput);

  children = set(undefined, (value: ReactNode) => {
    this.items = flatten(value);
    this.space = this.items.map(() => 1);
  });

  index?: number = 0;
  row?: boolean = undefined;

  gap = 9;

  items = [] as ReactNode[];
  space = [] as number[];

  dragging = '';

  Handle(props: HandleProps): React.ReactNode {
    return React.createElement('div');
  }

  public applyLayout(element: HTMLElement) {
    const { gap, row } = this;
    const [x, y] = row ? AXIS : AXIS.slice().reverse();

    element.style.position = 'relative';
    element.style[x] = `minmax(0, 1fr)`;

    return this.get(({ space }) => {
      element.style[y] = space
        .map((value) => `minmax(0, ${value}fr)`)
        .join(` ${gap}px `);
    });
  }

  protected getOutput() {
    const output: ReactNode[] = [];

    this.items.forEach((child: any, i, array) => {
      const index = i * 2;

      output.push(
        React.cloneElement(child, {
          ...child.props,
          key: index,
          index,
          parent: this
        })
      );

      if (i + 1 < array.length) {
        output.push(React.createElement(Spacer, { key: index + 1, index }));
      }
    });

    return output;
  }

  public nudge(index: number) {
    const { space, container, row, gap } = this;

    const rect = container.current!.getBoundingClientRect();
    const max = rect[row ? 'width' : 'height'] - (space.length - 1) * gap;
    const sum = space.reduce((a, n) => a + n, 0);

    this.space = space.map((x) => Math.round((x * max) / sum));

    return (x: number, y: number) => {
      const diff = row ? x : y;
      const prior = index / 2;
      const after = prior + 1;

      this.space[prior] += diff;
      this.space[after] -= diff;
      this.set('space');
    };
  }

  public resize(between: number) {
    const { parent, items, index = 0 } = this;

    let pull: ((value: any) => void) | undefined;
    let push: ((value: any) => void) | undefined;

    if (parent) {
      if (index > 1) pull = this.onDrag(between, index - 1);
      if (index < parent.items.length - 1) {
        push = this.onDrag(between, index + 1);
      }
    }

    return {
      grab: this.onDrag(between),
      pull,
      push
    };
  }

  protected onDrag(between: number, parentIndex?: number) {
    return (event: MouseEvent) => {
      if (event.button !== 0) return;

      event.stopPropagation();
      event.preventDefault();

      const { cursor } = getComputedStyle(event.currentTarget as Element);
      console.log('onDrag mousedown, this=', this, 'cursor=', cursor);

      for (let c: Control | undefined = this; c; c = c.parent) {
        console.log('  setting dragging on', c, 'was=', c.dragging);
        c.dragging = cursor;
        console.log('  now=', c.dragging);
      }

      const moveSelf = this.nudge(between);
      const moveParent =
        parentIndex !== undefined && this.parent
          ? this.parent.nudge(parentIndex)
          : undefined;

      let previous = { x: event.x, y: event.y };

      const onMove = (event: MouseEvent) => {
        const dX = event.x - previous.x;
        const dY = event.y - previous.y;

        if (dX || dY) {
          moveSelf(dX, dY);
          moveParent && moveParent(dX, dY);
        }

        previous = event;
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        for (let c: Control | undefined = this; c; c = c.parent)
          c.dragging = '';
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };
  }
}

Control.on((self) => {
  self.get(({ dragging }) => {
    console.log(
      `[listener] ${self.parent ? 'Control' : 'Panel'} dragging=${JSON.stringify(dragging)}`
    );
  });

  if (!self.parent) return;
  self.Handle = self.parent.Handle;
  if (self.row === undefined) self.row = !self.parent.row;
});

function Spacer({ index }: { index: number }) {
  return Control.get((layout) => {
    const { Handle, row, gap } = layout;
    const { grab, pull, push } = layout.resize(index);

    return React.createElement(Handle, {
      pull,
      push,
      grab: grab as any,
      vertical: row,
      width: gap
    });
  });
}

function flatten(input: ReactNode): ReactNode[] {
  const array = React.Children.toArray(input);

  return array.reduce((flatChildren: ReactNode[], child) => {
    const item = child as React.ReactElement<any>;

    if (item.type === React.Fragment)
      return flatChildren.concat(flatten(item.props.children));

    flatChildren.push(child);
    return flatChildren;
  }, []);
}
