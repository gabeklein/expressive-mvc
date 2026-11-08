import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Replace `workspace:` ranges with the versions they point at, the way
 * `pnpm publish` and `bun publish` do. `changeset publish` packs with npm,
 * which copies them verbatim - and a published `workspace:^` cannot be
 * installed outside this repo.
 *
 * Run with no arguments to rewrite every publishable package.json in place,
 * which `ci:publish` does on the release runner's throwaway checkout.
 */

type Manifest = Record<string, unknown> & { name: string; version: string; private?: boolean };

const FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies', 'devDependencies'];
const PACKAGES = resolve('packages');

export function manifests(): Map<string, { dir: string; manifest: Manifest }> {
  const found = new Map<string, { dir: string; manifest: Manifest }>();

  for (const entry of readdirSync(PACKAGES, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const dir = join(PACKAGES, entry.name);

    try {
      const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Manifest;
      found.set(manifest.name, { dir, manifest });
    } catch {
      // not a package
    }
  }

  return found;
}

/** A copy of `manifest` with each `workspace:` range resolved against `versions`. */
export function pinned(manifest: Manifest, versions: Map<string, string>): Manifest {
  const out: Manifest = { ...manifest };

  for (const field of FIELDS) {
    const deps = manifest[field] as Record<string, string> | undefined;

    if (!deps) continue;

    out[field] = Object.fromEntries(
      Object.entries(deps).map(([name, range]) => {
        if (!range.startsWith('workspace:')) return [name, range];

        const version = versions.get(name);
        const spec = range.slice('workspace:'.length);

        if (!version) throw new Error(`${manifest.name} depends on ${name} at ${range}, but no workspace package has that name.`);

        return [name, spec === '*' ? version : spec === '^' || spec === '~' ? spec + version : spec];
      })
    );
  }

  return out;
}

/** The `workspace:` ranges a manifest still carries, as `field.name`. */
export function unpinned(manifest: Manifest): string[] {
  return FIELDS.flatMap(field =>
    Object.entries((manifest[field] as Record<string, string>) ?? {})
      .filter(([, range]) => range.startsWith('workspace:'))
      .map(([name]) => `${field}.${name}`)
  );
}

if (import.meta.main) {
  const all = manifests();
  const versions = new Map([...all].map(([name, { manifest }]) => [name, manifest.version]));

  for (const { dir, manifest } of all.values()) {
    if (manifest.private) continue;

    const before = unpinned(manifest);

    if (!before.length) continue;

    writeFileSync(join(dir, 'package.json'), JSON.stringify(pinned(manifest, versions), null, 2) + '\n');
    console.log(`pinned ${manifest.name}: ${before.join(', ')}`);
  }
}
