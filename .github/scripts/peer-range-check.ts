import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

type Package = {
  name: string;
  version: string;
  private?: boolean;
  peerDependencies?: Record<string, string>;
};

const packages = new Map<string, Package>();

for (const entry of await readdir('packages', { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;

  const file = Bun.file(join('packages', entry.name, 'package.json'));
  if (await file.exists()) {
    const pkg = await file.json() as Package;
    packages.set(pkg.name, pkg);
  }
}

for (const pkg of packages.values()) {
  if (pkg.private) continue;

  for (const [name, range] of Object.entries(pkg.peerDependencies ?? {})) {
    const peer = packages.get(name);
    if (!peer) continue;

    const [major, minor] = peer.version.split('.').map(Number);
    if (major !== 0) continue;

    const nextMinor = `0.${minor + 1}.0`;
    const normalized = range.replace(/^workspace:/, '');
    if (!Bun.semver.satisfies(nextMinor, normalized)) {
      throw new Error(
        `${pkg.name} peer ${name}@${range} excludes ${nextMinor}; ` +
        'pre-1.0 internal peer ranges must cover the next minor release',
      );
    }
  }
}
