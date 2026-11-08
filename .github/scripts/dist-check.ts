import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

/**
 * Static invariants on the built dist, all learned from shipped breakage:
 *
 * 1. Every relative specifier resolves to a file that was actually emitted.
 *    Node's ESM resolver does not add extensions, so an extensionless emit
 *    (`from "./adapter"`) makes the package unloadable outside a bundler.
 *
 * 2. Every side-effect-only import (`import "./chunk-x.js"`) lands on a path
 *    covered by the package's `sideEffects`. Those imports exist solely to pull
 *    in prototype patches; a bundler told the target is pure drops them, and
 *    the chunk filenames are content-hashed, so the glob and the emitted names
 *    have to be kept in agreement.
 *
 * 3. Every emitted declaration is reachable from an exported `types` entry.
 *    rolldown-plugin-dts strips side-effect imports between declaration chunks,
 *    so a `declare module` augmentation split into its own chunk ships orphaned
 *    and consumers never see it.
 */
const PACKAGES = ['mvc', 'react', 'dom', 'router', 'inspect', 'steps'];

const IMPORTS = /(?:^|;)\s*(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]/gm;
const SIDE_EFFECT = /(?:^|;)\s*import\s*['"]([^'"]+)['"]/gm;

/** Match one `sideEffects` entry against a dist-relative path, `*` per segment. */
function covered(patterns: string[] | false | undefined, path: string) {
  if (!Array.isArray(patterns)) return false;

  return patterns.some((pattern) => {
    const source = pattern.replace(/^\.\//, '').replace(/[.+^${}()|[\]\\]/g, '\\$&');

    return new RegExp(`^${source.replace(/\*/g, '[^/]*')}$`).test(path);
  });
}

function walk(dir: string, extension = '.js'): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(join(dir, entry.name), extension)
      : entry.name.endsWith(extension)
        ? [join(dir, entry.name)]
        : []
  );
}

/** Every `types` target named by a package.json, at any depth of `exports`. */
function typesEntries(manifest: any, root: string): string[] {
  const found: string[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node != 'object') return;

    for (const [key, value] of Object.entries(node))
      if (key == 'types' && typeof value == 'string') found.push(resolve(root, value));
      else visit(value);
  };

  visit({ types: manifest.types, exports: manifest.exports });
  return found;
}

/** Declarations reachable from `entries` through relative specifiers. */
function reachable(entries: string[]) {
  const seen = new Set<string>();
  const queue = entries.filter(existsSync);

  for (const file of queue) {
    if (seen.has(file)) continue;
    seen.add(file);

    const source = readFileSync(file, 'utf8');

    for (const [, specifier] of [...source.matchAll(IMPORTS), ...source.matchAll(SIDE_EFFECT)])
      if (specifier.startsWith('.'))
        queue.push(resolve(dirname(file), specifier.replace(/\.js$/, '.d.ts')));
  }

  return seen;
}

const problems: string[] = [];

for (const name of PACKAGES) {
  const root = resolve('packages', name);
  const dist = join(root, 'dist');
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const { sideEffects } = manifest;

  if (!existsSync(dist))
    throw new Error(`packages/${name}/dist is missing - run \`bun run build\` first.`);

  const files = walk(dist);

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const from = relative(dist, file);

    for (const [, specifier] of source.matchAll(IMPORTS)) {
      if (!specifier.startsWith('.')) continue;

      if (!existsSync(resolve(dirname(file), specifier)))
        problems.push(
          `@expressive/${name}: dist/${from} imports "${specifier}", which was not emitted` +
          ` (Node ESM will not add an extension).`
        );
    }

    for (const [, specifier] of source.matchAll(SIDE_EFFECT)) {
      if (!specifier.startsWith('.')) continue;

      const target = relative(dist, resolve(dirname(file), specifier));

      if (!covered(sideEffects, `dist/${target}`))
        problems.push(
          `@expressive/${name}: dist/${from} imports "${specifier}" for side effects only,` +
          ` but dist/${target} is not listed in "sideEffects" - tree-shaking will drop it.`
        );
    }
  }

  const declarations = walk(dist, '.d.ts');
  const referenced = reachable(typesEntries(manifest, root));

  for (const file of declarations)
    if (!referenced.has(file))
      problems.push(
        `@expressive/${name}: dist/${relative(dist, file)} is not reachable from any exported` +
        ` \`types\` entry - its declarations will never load.`
      );

  console.log(
    `@expressive/${name}: ${files.length} emitted modules, ${declarations.length} declarations checked`
  );
}

if (problems.length)
  throw new Error(`Built dist is not consumable:\n\n${problems.map((p) => `  ${p}`).join('\n')}`);

console.log('\nAll relative specifiers resolve; side-effect imports are declared; declarations are reachable.');
