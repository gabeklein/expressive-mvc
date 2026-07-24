interface Output {
  write(text: string): unknown;
  isTTY?: boolean;
}

interface Terminal {
  /** Repaint the visible frame, replacing the previous one. Interactive only. */
  update(frame: string): void;
  /** Final write - repaints when interactive, appends once otherwise. */
  done(frame: string): void;
}

function terminal(out: Output): Terminal {
  let last: string | undefined;
  let lines = 0;

  function update(frame: string) {
    if (!out.isTTY || frame === last) return;

    let erase = '';

    if (last !== undefined) {
      for (let i = 0; i <= lines; i++)
        erase += '\x1b[2K' + (i < lines ? '\x1b[1A' : '');
      erase += '\r';
    }

    out.write(erase + frame + '\n');
    last = frame;
    lines = frame.split('\n').length;
  }

  function done(frame: string) {
    if (out.isTTY) update(frame);
    else out.write(frame + '\n');
  }

  return { update, done };
}

export { terminal };
export type { Output, Terminal };
