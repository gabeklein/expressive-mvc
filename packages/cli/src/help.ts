import type { Spec } from './input';
import { isNamed, isPlural, isRequired, kebab, label } from './parse';

function operand(spec: Spec) {
  const name = kebab(spec.key) + (isPlural(spec) ? '...' : '');
  const required = isPlural(spec) ? !!spec.config.min : isRequired(spec);

  return required ? `<${name}>` : `[${name}]`;
}

function option(spec: Spec) {
  const { short, type, default: fallback } = spec.config;
  const name = (short ? `-${short}, ` : '') + label(spec);

  if (spec.kind == 'flag') return name;

  const kind = type || (typeof fallback == 'number' || typeof fallback?.[0] == 'number' ? 'number' : 'value');

  return `${name} <${kind}>`;
}

function describe(spec: Spec) {
  const { help = '', default: fallback } = spec.config;
  const shown = spec.kind != 'flag' && fallback !== undefined && !(Array.isArray(fallback) && !fallback.length);

  return shown ? `${help}${help && ' '}(default: ${fallback})`.trim() : help;
}

function table(rows: [string, string][]) {
  const width = Math.max(...rows.map(([left]) => left.length));

  return rows.map(([left, right]) => `  ${right ? left.padEnd(width + 2) + right : left}`).join('\n');
}

/** Usage line for a command - its name, then `[options]` and its operands. */
function usage(name: string, specs: Spec[]) {
  const operands = specs.filter((spec) => !isNamed(spec)).map(operand);

  return ['Usage:', name, '[options]', ...operands].join(' ');
}

/** Full `--help` text - usage, then arguments and options with their help. */
function help(name: string, specs: Spec[]) {
  const operands = specs.filter((spec) => !isNamed(spec));
  const options = specs.filter(isNamed);
  const sections = [usage(name, specs)];

  if (operands.length)
    sections.push('Arguments:\n' + table(operands.map((spec) => [operand(spec), describe(spec)])));

  sections.push(
    'Options:\n' +
      table([...options.map((spec): [string, string] => [option(spec), describe(spec)]), ['-h, --help', 'show this help']])
  );

  return sections.join('\n\n');
}

export { help, usage };
