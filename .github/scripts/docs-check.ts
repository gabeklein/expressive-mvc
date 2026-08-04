import { Glob } from 'bun';
import { withWorkspaceLinks } from './workspace-links';

/**
 * Guards documentation against drifting out of agreement with the code.
 *
 * Two failure modes, both of which shipped undetected before this existed: a doc
 * teaching a symbol that no longer exists (`use(instance)` survived two releases
 * in SKILL.md after #289 deleted it), and a link to an anchor that was removed
 * with it.
 */
const SCOPES = ['@expressive/mvc', '@expressive/react', '@expressive/router'];

/** Written at build time by the serve-llm plugin, so it has no source file. */
const GENERATED_LLM = 'examples/index.md';

const release = withWorkspaceLinks();
const exported = new Map<string, Set<string>>();

try {
  for (const scope of SCOPES)
    exported.set(scope, new Set(Object.keys(await import(scope))));
} finally {
  release();
}

/** GitHub-style heading slug, which is what the docs site generates. */
const slugify = (heading: string) =>
  heading
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

type Doc = { path: string; text: string };

const docs: Doc[] = [];

for (const pattern of ['skills/**/*.md', 'website/content/**/*.{md,mdx}', 'website/public/llms.txt'])
  for await (const path of new Glob(pattern).scan('.'))
    docs.push({ path, text: await Bun.file(path).text() });

/** Heading slugs per docs-site route, for anchor resolution. */
const routes = new Map<string, Set<string>>();

for (const { path, text } of docs) {
  const route = path
    .replace(/^website\/content/, '')
    .replace(/\.mdx?$/, '')
    .replace(/\/index$/, '');

  if (!path.startsWith('website/content')) continue;

  const anchors = new Set<string>();

  for (const [, heading] of text.matchAll(/^#{2,6}\s+(.+?)\s*$/gm))
    anchors.add(slugify(heading));

  routes.set(route, anchors);
}

const problems: string[] = [];
const at = (path: string, text: string, index: number) =>
  `${path}:${text.slice(0, index).split('\n').length}`;

for (const { path, text } of docs) {
  // --- symbols imported in fenced examples must actually be exported ---
  // Anchored at a line start: prose and table cells contain the word "import"
  // too, and an unanchored clause happily spans them to reach a later specifier.
  for (const match of text.matchAll(
    /^\s*import\s+([^;`|]+?)\s+from\s+['"](@expressive\/[a-z]+)['"]/gm
  )) {
    const [, clause, scope] = match;
    const names = exported.get(scope);

    if (!names) continue;

    const named = /\{([^}]*)\}/.exec(clause)?.[1] ?? '';

    for (const entry of named.split(',')) {
      const name = entry.trim().split(/\s+as\s+/)[0].trim();

      if (name && !names.has(name))
        problems.push(
          `${at(path, text, match.index)}  imports { ${name} } from '${scope}', which does not export it`
        );
    }
  }

  // --- /llm/ links must resolve to a file the build actually publishes ---
  for (const match of text.matchAll(/\]\((\/llm\/[^)#\s]+)\)/g)) {
    const target = match[1].slice(5);

    if (target === GENERATED_LLM)
      continue;

    const found = await Promise.all(
      ['skills', 'website/content/llm'].map((dir) => Bun.file(`${dir}/${target}`).exists())
    );

    if (!found.includes(true))
      problems.push(`${at(path, text, match.index)}  links /llm/${target}, but no such document exists`);
  }

  // --- internal docs links must resolve, anchors included ---
  for (const match of text.matchAll(/\]\((\/docs\/[^)\s]*)\)/g)) {
    const [, target] = match;
    const [route, anchor] = target.split('#');
    const anchors = routes.get(route.replace(/\/$/, ''));

    if (!anchors)
      problems.push(`${at(path, text, match.index)}  links ${target}, but no such docs page exists`);
    else if (anchor && !anchors.has(anchor))
      problems.push(`${at(path, text, match.index)}  links ${target}, but that page has no such heading`);
  }
}

for (const scope of SCOPES)
  console.log(`${scope} exports: ${[...exported.get(scope)!].sort().join(', ')}`);

console.log(`\nChecked ${docs.length} documents.`);

if (problems.length)
  throw new Error(
    `Documentation disagrees with the code:\n\n${problems.map((p) => `  ${p}`).join('\n')}\n`
  );

console.log('Every documented symbol is exported and every internal link resolves.');
