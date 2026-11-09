import { Glob } from 'bun';
import { dirname, join, normalize } from 'path';
import { withWorkspaceLinks } from './workspace-links';

/**
 * Guards documentation against drifting out of agreement with the code.
 *
 * Two failure modes, both of which shipped undetected before this existed: a doc
 * teaching a symbol that no longer exists (`use(instance)` survived two releases
 * in SKILL.md after #289 deleted it), and a link to an anchor that was removed
 * with it.
 */
const SCOPES = ['@expressive/mvc', '@expressive/react', '@expressive/router', '@expressive/steps'];

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

/** Installed skills sit side by side, so a skill links a sibling as `../expressive-<pkg>/`. */
const skills = new Map<string, string>();

/** Skills a skill may link - its own and its dependencies', the only ones certain to be installed with it. */
const reach = new Map<string, Set<string>>();

for await (const path of new Glob('packages/*/skills/*/SKILL.md').scan('.')) {
  const name = path.split('/')[3];
  const pkg = await Bun.file(join(path.split('/').slice(0, 2).join('/'), 'package.json')).json();
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies });

  skills.set(name, dirname(path));
  reach.set(name, new Set([name, ...deps.filter((d) => d.startsWith('@expressive/')).map((d) => d.replace('@expressive/', 'expressive-'))]));
}

/** Path within the installed skills layout to its source file. */
const fromSkills = (path: string) => {
  const [name, ...rest] = path.split('/');
  const dir = skills.get(name);

  return dir && join(dir, ...rest);
};

const toSkills = (path: string) => path.replace(/^packages\/[^/]+\/skills\//, '');

const docs: Doc[] = [];

for (const pattern of ['packages/*/skills/**/*.md', 'website/content/**/*.{md,mdx}', 'website/public/llms.txt'])
  for await (const path of new Glob(pattern).scan('.'))
    docs.push({ path, text: await Bun.file(path).text() });

/** GitHub's own slug - every space a hyphen - since agents read skills as GitHub renders them. */
const headings = (text: string) =>
  new Set(
    [...text.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)].map(([, heading]) =>
      heading.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s/g, '-')
    )
  );

/** Heading slugs per docs-site route, for anchor resolution. */
const routes = new Map<string, Set<string>>();

for (const { path, text } of docs) {
  const route = path
    .replace(/^website\/content/, '')
    .replace(/\.mdx?$/, '')
    .replace(/\/index$/, '');

  if (!path.startsWith('website/content')) continue;

  const anchors = new Set<string>();

  for (const [, heading] of text.matchAll(/^#{2,6}\s+(.+?)\s*$/gm)) {
    // `## Heading [#custom]` pins the id, as fumadocs' remark-heading does.
    const custom = heading.match(/\s*\[#([^\]]+)\]$/);
    anchors.add(custom ? custom[1] : slugify(heading));
  }

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

    const source = fromSkills(target);
    const found = await Promise.all(
      [source, `website/content/llm/${target}`].map((file) => !!file && Bun.file(file).exists())
    );

    if (!found.includes(true))
      problems.push(`${at(path, text, match.index)}  links /llm/${target}, but no such document exists`);
  }

  // --- links between skill files must resolve once installed, anchors included ---
  if (path.startsWith('packages/'))
    for (const match of text.matchAll(/\]\((\.{0,2}[^)\s:#]*\.md)(?:#([^)\s]+))?\)/g)) {
      const [, target, anchor] = match;
      const into = normalize(join(dirname(toSkills(path)), target));
      const file = fromSkills(into);
      const from = toSkills(path).split('/')[0];

      if (file && !reach.get(from)!.has(into.split('/')[0])) {
        problems.push(`${at(path, text, match.index)}  links ${target}, but ${from} does not depend on that package - name the skill in plain text`);
        continue;
      }

      if (!file || !(await Bun.file(file).exists())) {
        problems.push(`${at(path, text, match.index)}  links ${target}, which is not in any installed skill`);
        continue;
      }

      if (anchor && !headings(await Bun.file(file).text()).has(anchor))
        problems.push(`${at(path, text, match.index)}  links ${target}#${anchor}, but that file has no such heading`);
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
