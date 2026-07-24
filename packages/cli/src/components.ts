import { Component } from '@expressive/mvc';
import { COLORS, MODIFIERS, pad, sgr, width, type Color, type Modifier } from './ansi';
import { Block } from './block';

class Text extends Block {
  color = undefined as Color | undefined;
  bold = false;
  dim = false;
  italic = false;
  underline = false;
  inverse = false;
  strike = false;

  format(text: string) {
    for (const key in MODIFIERS)
      if (this[key as Modifier]) {
        const [open, close] = MODIFIERS[key as Modifier];
        text = sgr(open, close, text);
      }

    if (this.color) text = sgr(COLORS[this.color], 39, text);

    return text;
  }
}

const BORDERS = {
  round: '╭╮╰╯─│',
  single: '┌┐└┘─│',
  double: '╔╗╚╝═║',
  bold: '┏┓┗┛━┃'
};

class Panel extends Block {
  border = 'round' as keyof typeof BORDERS;
  padding = 0;
  title = '';

  format(text: string) {
    const [tl, tr, bl, br, h, v] = [...BORDERS[this.border]];
    const space = this.padding;
    const lines = text.split('\n');

    while (lines.length && !lines[lines.length - 1]) lines.pop();

    const head = this.title ? ` ${this.title} ` : '';
    const w = Math.max(width(head), ...lines.map(width));
    const inner = w + space * 2;
    const blank = Array<string>(space).fill('');
    const rows = [...blank, ...lines, ...blank].map(
      (line) => v + ' '.repeat(space) + pad(line, w) + ' '.repeat(space) + v
    );

    return [
      tl + head + h.repeat(inner - width(head)) + tr,
      ...rows,
      bl + h.repeat(inner) + br
    ].join('\n');
  }
}

class Spinner extends Component {
  frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  interval = 80;
  frame = 0;

  new() {
    const timer = setInterval(() => this.frame++, this.interval);
    return () => clearInterval(timer);
  }

  render() {
    return this.frames[this.frame % this.frames.length];
  }
}

class Progress extends Component {
  value = 0;
  width = 24;
  filled = '█';
  empty = '░';

  render() {
    const scale = Math.min(1, Math.max(0, this.value));
    const count = Math.round(scale * this.width);

    return this.filled.repeat(count) + this.empty.repeat(this.width - count);
  }
}

export { Panel, Progress, Spinner, Text };
