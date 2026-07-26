import { Component, get, ref, set } from '@expressive/react';
import React, { type MouseEventHandler, type ReactNode } from 'react';

const AXIS = ['gridTemplateRows', 'gridTemplateColumns'] as const;

type DragEvent = () => (x: number, y: number) => void;

export interface HandleProps {
  grab: MouseEventHandler;
  pull?: MouseEventHandler;
  push?: MouseEventHandler;
  vertical?: boolean;
  width?: number;
  /** True while this handle owns an in-progress drag - render a mask over
   *  managed UI (e.g. an iframe) so the pointer keeps feeding this document. */
  active?: boolean;
}

export class Control extends Component {
  static managed = new WeakSet();

  container = ref(this.applyLayout);

  parent = get(Control, false);
  // Reactive (arity 1) so output tracks `items` and refreshes when children
  // change - e.g. the live iframe element rebinding its theme ref - while
  // staying stable across renders that don't touch the child set.
  output = set((self: Control) => self.getOutput());

  children = set(undefined, (value: ReactNode) => {
    this.items = flatten(value);
    this.space = this.items.map(() => 1);
  });

  index?: number = 0;
  row?: boolean = undefined;

  // Spacer index of an in-progress drag, or undefined at rest.
  dragging?: number = undefined;

  gap = 9;

  items = [] as ReactNode[];
  space = [] as number[];

  Handle(props: HandleProps): React.ReactNode {
    return React.createElement('div');
  }

  public applyLayout(element: HTMLElement) {
    const { gap, row } = this;
    const [x, y] = row ? AXIS : AXIS.slice().reverse();

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
    const { parent, index = 0 } = this;
    const move = () => this.nudge(between);

    // Flag the drag so the active Handle can mask managed UI, and hand the
    // native event to onDrag (real x/y, unlike a pooled synthetic).
    const track =
      (base: (event: MouseEvent) => void): MouseEventHandler =>
      (event) => {
        this.dragging = between;

        const done = () => {
          this.dragging = undefined;
          document.removeEventListener('mouseup', done);
        };

        document.addEventListener('mouseup', done);
        base(event.nativeEvent);
      };

    let pull: MouseEventHandler | undefined;
    let push: MouseEventHandler | undefined;

    if (parent) {
      if (index > 1)
        pull = track(onDrag(move, () => parent.nudge(index - 1)));

      if (index < parent.items.length - 1)
        push = track(onDrag(move, () => parent.nudge(index + 1)));
    }

    return {
      grab: track(onDrag(move)),
      pull,
      push
    };
  }
}

Control.on((self) => {
  if (!self.parent) return;
  self.Handle = self.parent.Handle;
  if (self.row === undefined) self.row = !self.parent.row;
});

function onDrag(...handle: DragEvent[]) {
  return (event: MouseEvent) => {
    if (event.button !== 0) return;

    event.stopPropagation();
    event.preventDefault();

    const move = handle.map((x) => x());
    let previous = { x: event.x, y: event.y };

    function onMove(event: MouseEvent) {
      const dX = event.x - previous.x;
      const dY = event.y - previous.y;

      if (dX || dY) move.forEach((cb) => cb(dX, dY));

      previous = event;
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };
}

function Spacer({ index }: { index: number }) {
  return Control.get((layout) => {
    const { grab, pull, push } = layout.resize(index);
    const { Handle, row, gap } = layout;

    return React.createElement(Handle, {
      pull,
      push,
      grab,
      vertical: row,
      width: gap,
      active: layout.dragging === index
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
