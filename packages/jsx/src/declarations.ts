type Declaration = Record<string, unknown>;

function applyDeclarations(style: CSSStyleDeclaration, declarations: Declaration) {
  const target = style as any;

  for (const key of Object.keys(declarations)) {
    const value = declarations[key];
    if (key.startsWith('--')) {
      style.setProperty(key, value == null ? '' : String(value));
      continue;
    }

    if (typeof value == 'number') target[key] = '';
    target[key] = value == null ? '' : value;
    if (typeof value == 'number' && value !== 0 && !target[key]) target[key] = `${value}px`;
  }
}

export { applyDeclarations };
export type { Declaration };
