import type State from "@expressive/react";
import { Control, type HandleProps } from "./Control";

export class Panel extends Control {
  render() {
    const { output, container } = this;

    return <div _grid ref={container}>{output}</div>;
  }

  Handle({ grab, pull, push, vertical, width }: HandleProps) {
    position: relative;

    bar: {
      position: absolute;
      radius: round;
      transition: "background 0.1s ease-out";
      background: 0xFFFFFF03;

      $hover: {
        background: $accentLight; 
      }
    }

    if (vertical) {
      cursor: "col-resize";
      bar: {
        top: 10;
        bottom: 10;
        right: 3;
        left: 3;
      }
    } else {
      cursor: "row-resize";
      bar: {
        top: 3;
        bottom: 3;
        right: 10;
        left: 10;
      }
    }

    return (
      <div onMouseDown={grab}>
        <div _bar />
        <Corner onMouseDown={pull} style={{ left: -width, top: 0 }} />
        <Corner onMouseDown={push} style={{ right: -width, bottom: 0 }} />
      </div>
    );
  }
}

export const Row = (props) => <Panel row {...props} />;
export const Column = (props) => <Panel {...props} />;

export { Column as Col };

interface CornerProps {
  onMouseDown?: () => void;
  style: React.CSSProperties;
}

function Corner(props: CornerProps) {
  position: absolute;
  cursor: move;
  radius: round;
  size: 9;
  borderColor: transparent;
  borderStyle: solid;
  zIndex: 10;

  $hover: {
    borderColor: $accentLight;
  }

  if (!props.onMouseDown) return null;

  return <div {...props} />;
}
