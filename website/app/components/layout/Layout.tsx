import type { MouseEventHandler } from 'react';
import { Control, type HandleProps } from './Control';

export class Panel extends Control {
  Handle = Handle;

  render() {
    const { output, container } = this;

    return (
      <div className="grid" ref={container}>
        {output}
      </div>
    );
  }
}

function Handle(props: HandleProps) {
  const { grab, pull, push, vertical, width } = props;

  return (
    <div
      className={
        vertical ? 'relative cursor-col-resize' : 'relative cursor-row-resize'
      }
      onMouseDown={grab}>
      <div
        className={
          'absolute rounded-full [transition:background_0.1s_ease-out] bg-white/1 hover:bg-(--accent-light) ' +
          (vertical ? 'inset-y-2.5 inset-x-1' : 'inset-y-1 inset-x-2.5')
        }
      />
      {pull && (
        <Corner onMouseDown={pull} style={{ left: -(width || 0), top: 0 }} />
      )}
      {push && (
        <Corner
          onMouseDown={push}
          style={{ right: -(width || 0), bottom: 0 }}
        />
      )}
    </div>
  );
}

interface CornerProps {
  onMouseDown?: MouseEventHandler;
  style?: React.CSSProperties;
}

const Corner = (props: CornerProps) => (
  <div
    className="absolute cursor-move rounded-full size-2.5 border-transparent border-solid z-10 hover:border-(--accent-light)"
    {...props}
  />
);
