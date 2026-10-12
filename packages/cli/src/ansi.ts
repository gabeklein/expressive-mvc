const CODES = /\x1b\[[0-9;]*m/g;

/** Visible width of text, ignoring escape sequences. */
function width(text: string): number {
  return [...text.replace(CODES, '')].length;
}

/** Pad text with trailing spaces to a visible width. */
function pad(text: string, to: number): string {
  return text + ' '.repeat(Math.max(0, to - width(text)));
}

/**
 * Wrap each line of text in an SGR style. Nested closes of the same kind
 * re-open the outer style, and empty lines stay bare.
 */
function sgr(open: number, close: number, text: string): string {
  const O = `\x1b[${open}m`;
  const C = `\x1b[${close}m`;

  return text
    .split('\n')
    .map((line) => (line ? O + line.split(C).join(C + O) + C : line))
    .join('\n');
}

const COLORS = {
  black: 30,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  white: 37,
  gray: 90,
  brightRed: 91,
  brightGreen: 92,
  brightYellow: 93,
  brightBlue: 94,
  brightMagenta: 95,
  brightCyan: 96,
  brightWhite: 97
};

const MODIFIERS = {
  bold: [1, 22],
  dim: [2, 22],
  italic: [3, 23],
  underline: [4, 24],
  inverse: [7, 27],
  strike: [9, 29]
} as const;

type Color = keyof typeof COLORS;
type Modifier = keyof typeof MODIFIERS;

export { COLORS, MODIFIERS, pad, sgr, width };
export type { Color, Modifier };
