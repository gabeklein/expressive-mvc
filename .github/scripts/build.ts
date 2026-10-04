import { Glob } from 'bun';
import { dirname } from 'node:path';

const packages = new Map<string, { dir: string; deps: string[] }>();

for await (const file of new Glob('packages/*/package.json').scan()) {
  const manifest = await Bun.file(file).json();

  if (manifest.scripts?.build)
    packages.set(manifest.name, {
      dir: dirname(file),
      deps: Object.keys({
        ...manifest.dependencies,
        ...manifest.peerDependencies,
        ...manifest.devDependencies
      })
    });
}

const built = new Set<string>();

while (built.size < packages.size) {
  const wave = [...packages].filter(([name, { deps }]) =>
    !built.has(name) && deps.every((dep) => built.has(dep) || !packages.has(dep))
  );

  if (!wave.length) {
    const left = [...packages.keys()].filter((name) => !built.has(name));
    throw new Error(`Workspace dependency cycle among ${left.join(', ')}.`);
  }

  const codes = await Promise.all(
    wave.map(([, { dir }]) =>
      Bun.spawn(['bun', 'run', 'build'], { cwd: dir, stdio: ['inherit', 'inherit', 'inherit'] }).exited
    )
  );

  if (codes.some(Boolean)) process.exit(1);

  for (const [name] of wave) built.add(name);
}
