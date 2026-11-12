import type { Spec } from './input';
import { isNamed, isPlural, isRequired, kebab, label, valueType } from './parse';

function operand(spec: Spec) {
  const name = kebab(spec.key) + (isPlural(spec) ? '...' : '');
  const required = isPlural(spec) ? !!spec.config.min : isRequired(spec);

  return required ? `<${name}>` : `[${name}]`;
}

function option(spec: Spec) {
  const name = (spec.config.short ? `-${spec.config.short}, ` : '') + label(spec);

  if (spec.kind == 'flag') return name;

  const kind = valueType(spec);

  return `${name} <${kind == 'string' ? 'value' : kind}>`;
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

function scope(levels: Spec[][]) {
  const leaf = levels[levels.length - 1];
  const seen = new Set<string>();
  const options: Spec[] = [];

  for (let i = levels.length; i--; )
    for (const spec of levels[i])
      if (isNamed(spec) && !seen.has(spec.key)) {
        seen.add(spec.key);
        options.push(spec);
      }

  return {
    operands: leaf.filter((spec) => spec.kind == 'arg' || spec.kind == 'args'),
    commands: leaf.filter((spec) => spec.kind == 'sub'),
    options
  };
}

/** Usage line for a command path - its name, then `[options]`, a command if it has subs, and operands. */
function usage(name: string, levels: Spec[][], runs = true) {
  const { operands, commands } = scope(levels);
  const command = commands.length ? [runs ? '[command]' : '<command>'] : [];

  return ['Usage:', name, '[options]', ...command, ...operands.map(operand)].join(' ');
}

/** Full `--help` text - usage, then arguments, commands, and every option in scope with its help. */
function help(name: string, levels: Spec[][], runs = true) {
  const { operands, commands, options } = scope(levels);
  const sections = [usage(name, levels, runs)];

  if (operands.length)
    sections.push('Arguments:\n' + table(operands.map((spec) => [operand(spec), describe(spec)])));

  if (commands.length)
    sections.push('Commands:\n' + table(commands.map((spec) => [kebab(spec.key), spec.config.help || ''])));

  sections.push(
    'Options:\n' +
      table([...options.map((spec): [string, string] => [option(spec), describe(spec)]), ['-h, --help', 'show this help']])
  );

  return sections.join('\n\n');
}

export { help, usage };
