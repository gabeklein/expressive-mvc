import { $ } from 'bun';

/**
 * A major release needs sign-off: the `major` label on the pull request.
 *
 * Two places a major shows up: a changeset the PR adds or edits that bumps a
 * package `major`, and a package version crossing a major against the base -
 * how the Version Packages PR, whose changesets are already consumed, shows it.
 * Before 1.0 a breaking change is `minor`; `major` publishes 1.0.0.
 */
const base = `origin/${process.env.BASE || 'main'}`;
const approved = process.env.APPROVED === 'true';
const found: string[] = [];

const lines = (out: string) => out.split('\n').filter(Boolean);
const major = (version: string) => Number(version.split('.')[0]);

const changesets = await $`git diff --name-only --diff-filter=AM ${base}...HEAD -- ${'.changeset/*.md'}`.text();

for (const file of lines(changesets)) {
  const head = (await Bun.file(file).text()).match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';

  for (const [, name] of head.matchAll(/^['"]?([^'":]+)['"]?\s*:\s*major\s*$/gm))
    found.push(`${name}: major in ${file}`);
}

for (const file of lines(await $`git ls-files ${'packages/*/package.json'}`.text())) {
  const before = await $`git show ${base}:${file}`.nothrow().quiet();

  if (before.exitCode) continue;

  const prev = JSON.parse(before.text());
  const next = await Bun.file(file).json();

  if (!next.private && major(next.version) > major(prev.version))
    found.push(`${next.name}: ${prev.version} -> ${next.version}`);
}

if (!found.length) console.log('No major release.');
else if (approved) console.log(`Major release approved by label:\n  ${found.join('\n  ')}`);
else
  throw new Error(
    `Major release without sign-off:\n  ${found.join('\n  ')}\n\n` +
    `Add the \`major\` label to approve it. Before 1.0 a breaking change is \`minor\`.`
  );
