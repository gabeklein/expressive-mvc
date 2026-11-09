type Declaration = Record<string, unknown>;

const TOKEN = /\x01(\d+)\x01/g;
const tokens: [name: string, alias: string][] = [];

function token(name: string, alias: string) {
  return `\x01${tokens.push([name, alias]) - 1}\x01`;
}

function resolve(value: unknown) {
  if (typeof value != 'string') return value;

  return value.replace(TOKEN, (_, id: string) => {
    const [name, alias] = tokens[+id];

    if (alias[0] == '@' || alias[0] == ':')
      throw new Error(`Condition "${name}" is not a value.`);

    return alias.startsWith('--') ? `var(${alias})` : alias;
  });
}

function applyDeclarations(style: CSSStyleDeclaration, declarations: Declaration, previous: Declaration = {}) {
  const target = style as any;

  for (const key of Object.keys({ ...previous, ...declarations })) {
    const value = resolve(declarations[key]);

    if (key.startsWith('--')) {
      style.setProperty(key, value == null ? '' : String(value));
      continue;
    }

    if (typeof value == 'number') target[key] = '';
    target[key] = value == null ? '' : value;
    if (typeof value == 'number' && value !== 0 && !target[key]) target[key] = `${value}px`;
  }
}

function serialize(document: Document, declarations: Declaration) {
  const value = document.createElement('div').style;
  applyDeclarations(value, declarations);
  return value.cssText;
}

export { applyDeclarations, serialize, token };
export type { Declaration };
