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
const SCOPES = ['@expressive/mvc', '@expressive/react', '@expressive/router', '@expressive/steps', '@expressive/dom', '@expressive/inspect', '@expressive/rpc', '@expressive/dev'];

/** Written at build time by the serve-llm plugin, so it has no source file. */
const GENERATED_LLM = 'examples/index.md';

const release = withWorkspaceLinks();
const exported = new Map<string, Set<string>>();

try {
  // Each host adapter registers itself on import and refuses a second, so every scope loads alone.
  for (const scope of SCOPES) {
    const run = Bun.spawnSync(['bun', '-e', `console.log(JSON.stringify(Object.keys(await import('${scope}'))))`]);

    if (!run.success)
      throw new Error(`Could not import ${scope}:\n${run.stderr}`);

    exported.set(scope, new Set(JSON.parse(run.stdout.toString())));
  }
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

const problems: string[] = [];

/** Skill name to its source directory. Installed, a skill sits at `node_modules/@expressive/<pkg>/skills/expressive-<pkg>/`. */
const skills = new Map<string, string>();

for (const pattern of ['packages/*/skills/*/SKILL.md', 'skills/*/SKILL.md']) for await (const path of new Glob(pattern).scan('.')) {
  const name = path.split('/').at(-2)!;

  try {
    const meta = Bun.YAML.parse((await Bun.file(path).text()).match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '') as any;

    if (meta?.name !== name || typeof meta.description !== 'string')
      problems.push(`${path}  frontmatter needs name: ${name} and a description`);
  } catch (error) {
    problems.push(`${path}  frontmatter is not valid YAML, so skill installers skip it - ${(error as Error).message}`);
  }

  skills.set(name, dirname(path));
}

/** Path within the installed skills layout to its source file. */
const fromSkills = (path: string) => {
  const [name, ...rest] = path.split('/');
  const dir = skills.get(name);

  return dir && join(dir, ...rest);
};

const toSkills = (path: string) => path.replace(/^(packages\/[^/]+\/)?skills\//, '');

const docs: Doc[] = [];

for (const pattern of ['packages/*/skills/**/*.md', 'skills/**/*.md', 'website/content/**/*.{md,mdx}', 'website/public/llms.txt'])
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

  // --- a skill links only its own files; other skills are named in plain text, and those names must resolve ---
  if (toSkills(path) !== path) {
    const from = toSkills(path).split('/')[0];

    for (const match of text.matchAll(/\]\((\.{0,2}[^)\s:#]*\.md)(?:#([^)\s]+))?\)/g)) {
      const [, target, anchor] = match;
      const into = normalize(join(dirname(toSkills(path)), target));
      const file = fromSkills(into);

      if (into.split('/')[0] !== from)
        problems.push(`${at(path, text, match.index)}  links ${target} outside its own skill - name it in plain text, as \`${into}\``);
      else if (!file || !(await Bun.file(file).exists()))
        problems.push(`${at(path, text, match.index)}  links ${target}, which does not exist`);
      else if (anchor && !headings(await Bun.file(file).text()).has(anchor))
        problems.push(`${at(path, text, match.index)}  links ${target}#${anchor}, but that file has no such heading`);
    }

    for (const match of text.matchAll(/`(expressive-[a-z]+\/[^`\s#]+\.md)(?:#([^`\s]+))?`/g)) {
      const [, target, anchor] = match;
      const file = fromSkills(target);

      if (!file || !(await Bun.file(file).exists()))
        problems.push(`${at(path, text, match.index)}  names ${target}, which is not in any skill`);
      else if (anchor && !headings(await Bun.file(file).text()).has(anchor))
        problems.push(`${at(path, text, match.index)}  names ${target}#${anchor}, but that file has no such heading`);
    }
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
