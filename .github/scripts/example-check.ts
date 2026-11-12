import { Glob } from 'bun';
import { dirname, join, resolve } from 'path';
import ts from 'typescript';

/**
 * Typechecks every `@example` in public JSDoc against the package's source, so a hover example
 * cannot drift from the API it shows.
 *
 * A fragment is placed where it would be written: statements in a method body, members (fields,
 * methods) in a class body - both on a subclass of the package's host class where it has one, `this`
 * as the instance.
 * Free names (`stripe`, `Cart`) are placeholders, so "cannot find name" is not reported.
 */
const HOSTS: Record<string, string> = { mvc: 'Model', steps: 'Steps', cli: 'Model' };

const PLACEHOLDER = new Set([2304, 2552, 2582, 2662, 2663, 18004]);
const MODIFIERS = String.raw`^(?:(?:async|protected|public|private|static|readonly|override|declare|get|set)\s+)*`;
const METHOD = new RegExp(MODIFIERS + String.raw`(?!(?:if|for|while|switch|catch|function|return|await)\b)[\w$]+\s*(?:<[^>]*>)?\([^)]*\)\s*(?::[^{]*)?\{\s*$`);
const FIELD = new RegExp(MODIFIERS + String.raw`[\w$#]+[?!]?\s*(?::\s*[^=;]+)?(?:=(?![=>])|;\s*$)`);
const MEMBER = { test: (line: string) => METHOD.test(line) || FIELD.test(line) };

type Example = { file: string; line: number; code: string };

const problems: string[] = [];
let checked = 0;

for await (const config of new Glob('packages/*/tsconfig.json').scan('.')) {
  const dir = dirname(config);
  const pkg = dir.split('/')[1];
  const examples: Example[] = [];

  for await (const file of new Glob('src/**/*.{ts,tsx}').scan(dir)) {
    if (/\.test\.tsx?$/.test(file)) continue;

    const path = join(dir, file);
    const text = await Bun.file(path).text();

    for (const block of text.matchAll(/\/\*\*[\s\S]*?\*\//g)) {
      const lines = block[0].split('\n').map((line) => line.replace(/^\s*\/?\*+\/?\s?/, ''));
      const start = text.slice(0, block.index).split('\n').length;

      lines.forEach((line, i) => {
        if (!line.startsWith('@example')) return;

        const body: string[] = [];

        for (const next of lines.slice(i + 1)) {
          if (next.startsWith('@')) break;
          body.push(next);
        }

        examples.push({ file: path, line: start + i, code: body.join('\n').trim() });
      });
    }
  }

  if (!examples.length) continue;

  const parsed = ts.getParsedCommandLineOfConfigFile(resolve(config), {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (d) => problems.push(ts.flattenDiagnosticMessageText(d.messageText, '\n'))
  })!;

  const options = { ...parsed.options, noUnusedLocals: false, noImplicitAny: false, noEmit: true, incremental: false };
  const entry = resolve(dir, 'src/index.ts');
  const exported = (() => {
    const program = ts.createProgram([entry], options);
    const symbol = program.getTypeChecker().getSymbolAtLocation(program.getSourceFile(entry)!);

    return symbol ? program.getTypeChecker().getExportsOfModule(symbol).map((s) => s.name).filter((name) => name !== 'default') : [];
  })();

  const host = HOSTS[pkg];
  const header =
    `import { ${exported.join(', ')} } from '@expressive/${pkg}';\n` +
    (host && !exported.includes(host) ? `import { ${host} } from '@expressive/mvc';\n` : '');
  const virtual = new Map<string, { example: Example; offset: number }>();
  const sources = new Map<string, string>();

  examples.forEach((example, n) => {
    const { code } = example;
    const name = resolve(dir, `src/__example_${n}.ts`);
    let wrapped: string;

    if (/^(import|export|class|abstract class|function|type|interface)\b/.test(code))
      wrapped = code;
    else if (!host)
      wrapped = `async function __example() {\n${code}\n}`;
    else if (MEMBER.test(code.split('\n')[0]))
      wrapped = `abstract class __Example extends ${host} {\n[key: string]: any;\n${code}\n}`;
    else
      wrapped = `abstract class __Example extends ${host} {\n[key: string]: any;\nasync __step() {\n${code}\n}\n}`;

    const source = `${header}${wrapped}\nexport {};\n`;
    const offset = source.indexOf(code) ? source.slice(0, source.indexOf(code)).split('\n').length - 1 : 0;

    sources.set(name, source);
    virtual.set(name, { example, offset });
  });

  const compiler = ts.createCompilerHost(options);
  const { getSourceFile, fileExists, readFile } = compiler;

  compiler.fileExists = (file) => sources.has(resolve(file)) || fileExists(file);
  compiler.readFile = (file) => sources.get(resolve(file)) ?? readFile(file);
  compiler.getSourceFile = (file, lang, ...rest) => {
    const text = sources.get(resolve(file));

    return text !== undefined
      ? ts.createSourceFile(file, text, lang, true)
      : getSourceFile(file, lang, ...rest);
  };

  const program = ts.createProgram([...sources.keys()], options, compiler);

  for (const file of sources.keys()) {
    const { example, offset } = virtual.get(file)!;
    const source = program.getSourceFile(file)!;

    checked++;

    for (const diagnostic of [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)]) {
      if (PLACEHOLDER.has(diagnostic.code)) continue;

      const { line } = source.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');

      const span = source.text.slice(diagnostic.start ?? 0, (diagnostic.start ?? 0) + (diagnostic.length ?? 0));

      problems.push(`${example.file}:${example.line + 1 + Math.max(0, line - offset)}  TS${diagnostic.code} \`${span}\` ${message}`);
    }
  }
}

console.log(`Checked ${checked} examples.`);

if (problems.length)
  throw new Error(`Examples disagree with the code:\n\n${problems.map((p) => `  ${p}`).join('\n')}\n`);

console.log('Every example typechecks.');
