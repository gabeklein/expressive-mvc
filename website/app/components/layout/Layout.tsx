import type { MouseEventHandler } from "react";
import { Control, type HandleProps } from "./Control";

export class Panel extends Control {
  Handle = Handle;

  render(){
    const { output, container } = this;

    grid: {
      display: grid;
      flex: 1;
      minHeight: 0;
      minWidth: 0;
    }

    return <div _grid ref={container}>{output}</div>;
  }
}

function Handle(props: HandleProps) {
  const { grab, pull, push, vertical, width } = props;

  position: relative;
  cursor: "row-resize";

  bar: {
    absolute: 3, 10;
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
      absolute: 10, 3;
    }
  }

  return (
    <div onMouseDown={grab}>
      <div _bar />
      {pull && <Corner onMouseDown={pull} style={{ left: -(width || 0), top: 0 }} />}
      {push && <Corner onMouseDown={push} style={{ right: -(width || 0), bottom: 0 }} />}
    </div>
  );
}

interface CornerProps {
  onMouseDown?: MouseEventHandler;
  style?: React.CSSProperties;
}

const Corner = (props: CornerProps) => {
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

  return <div {...props} />;
};
