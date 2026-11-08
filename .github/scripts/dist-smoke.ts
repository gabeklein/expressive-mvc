import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { manifests, pinned, unpinned } from './pin-workspace';

/**
 * Pack every publishable package, install the tarballs into a throwaway project
 * outside the repo, and execute the result under native Node ESM. Nothing else
 * in CI resolves the built dist the way a consumer does: vitest aliases the
 * scope onto sources, and `npm publish --dry-run` runs no code at all.
 *
 * Probes and the consumer app live in `dist-smoke/`, copied into the fixture so
 * their bare imports resolve against the installed tarballs. The consumer is a
 * dom app built the way a consumer builds one: type-checked against the
 * published declarations with `skipLibCheck` off, bundled and minified so
 * `sideEffects` tree-shaking applies, then driven under happy-dom.
 *
 * Each package packs from a staged copy whose `workspace:` ranges are pinned
 * as `ci:publish` pins them, and a packed manifest that still has one fails.
 */
const PACKAGES = ['mvc', 'react', 'dom', 'router', 'inspect', 'steps', 'rpc', 'dev'];

function run(cmd: string[], cwd: string) {
  const { exitCode, stdout, stderr } = Bun.spawnSync(cmd, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const out = stdout.toString();
  const err = stderr.toString();

  if (exitCode !== 0)
    throw new Error(`\`${cmd.join(' ')}\` failed in ${cwd}:\n${out}\n${err}`);

  return out;
}

const ROOT = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
const fixture = mkdtempSync(join(tmpdir(), 'expressive-dist-smoke-'));
const tarballs: Record<string, string> = {};

try {
  const all = manifests();
  const versions = new Map([...all].map(([name, { manifest }]) => [name, manifest.version]));

  for (const name of PACKAGES) {
    const { dir, manifest } = all.get(`@expressive/${name}`)!;
    const stage = join(fixture, 'stage', name);
    const manifestOut = pinned(manifest, versions);
    const left = unpinned(manifestOut);

    if (left.length) throw new Error(`@expressive/${name} would publish workspace: ranges: ${left.join(', ')}`);

    mkdirSync(stage, { recursive: true });

    for (const entry of readdirSync(dir))
      if (entry === 'dist' || /^(readme|license|changelog)/i.test(entry)) cpSync(join(dir, entry), join(stage, entry), { recursive: true });

    if (!existsSync(join(stage, 'dist'))) throw new Error(`@expressive/${name} has no dist - build first.`);

    writeFileSync(join(stage, 'package.json'), JSON.stringify(manifestOut, null, 2));

    const packed = run(['npm', 'pack', '--json', '--pack-destination', fixture], stage);
    const [{ filename }] = JSON.parse(packed);

    tarballs[`@expressive/${name}`] = `file:./${filename}`;
    console.log(`packed @expressive/${name} -> ${filename}`);
  }

  writeFileSync(
    join(fixture, 'package.json'),
    JSON.stringify(
      {
        name: 'dist-smoke',
        version: '0.0.0',
        private: true,
        type: 'module',
        dependencies: {
          ...tarballs,
          react: '^19',
          'react-dom': '^19',
          'happy-dom': ROOT.devDependencies['happy-dom'],
          typescript: ROOT.devDependencies.typescript
        },
        overrides: tarballs
      },
      null,
      2
    )
  );

  run(['npm', 'install', '--no-audit', '--no-fund', '--loglevel=error'], fixture);

  cpSync(resolve('.github/scripts/dist-smoke'), fixture, { recursive: true });

  for (const name of PACKAGES)
    process.stdout.write(run(['node', `probes/${name}.mjs`], fixture));

  const consumer = join(fixture, 'consumer');

  run(['node', '../node_modules/typescript/bin/tsc', '-p', '.'], consumer);
  run(['bun', 'build', 'app.tsx', '--outfile', 'bundle.js', '--format', 'esm', '--minify'], consumer);
  process.stdout.write(run(['node', 'consumer.mjs'], consumer));
} catch (error) {
  console.error(`Fixture kept for inspection: ${fixture}`);
  throw error;
}

rmSync(fixture, { recursive: true, force: true });

console.log('\nPublished dist imports and executes under Node ESM.');
