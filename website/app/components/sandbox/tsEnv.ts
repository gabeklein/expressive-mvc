import { setupTypeAcquisition } from '@typescript/ata';
import {
  createSystem,
  createVirtualTypeScriptEnvironment,
  type VirtualTypeScriptEnvironment,
} from '@typescript/vfs';
import ts from 'typescript';

const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,
  esModuleInterop: true,
  allowJs: true,
  skipLibCheck: true,
  strict: true,
  lib: ['lib.dom.d.ts', 'lib.dom.iterable.d.ts', 'lib.esnext.d.ts'],
};

const CODE_FILE = /\.[jt]sx?$/;

// vfs's own cache reaches for localStorage, which a worker doesn't have, and the
// CDN sends no cache-control - so persist the libs through the Cache API, keyed
// by TS version, and fall back to a plain fetch where it isn't available.
let libStore: Promise<Cache> | undefined;

const getLibStore = () =>
  (libStore ??= (async () => {
    const name = `ts-lib-${ts.version}`;

    for (const key of await caches.keys())
      if (key.startsWith('ts-lib-') && key !== name) await caches.delete(key);

    return caches.open(name);
  })());

const fetchLib = async (url: string) => {
  try {
    const cache = await getLibStore();
    const hit = await cache.match(url);

    if (hit) return hit;

    const response = await fetch(url);

    if (response.ok) await cache.put(url, response.clone());

    return response;
  } catch {
    return fetch(url);
  }
};

const LIB_REFERENCE = /\/\/\/\s*<reference\s+lib="([^"]+)"\s*\/>/g;

// vfs's knownLibFilesForCompilerOptions guesses the lib set by prefix-cutting a
// hardcoded list, which yields just lib.d.ts for these options - walk each lib's
// own `reference lib` graph instead, so the env gets exactly what it needs.
async function collectLib(
  map: Map<string, string>,
  name: string,
  seen: Set<string>,
) {
  if (seen.has(name)) return;

  seen.add(name);

  const response = await fetchLib(
    `https://playgroundcdn.typescriptlang.org/cdn/${ts.version}/typescript/lib/${name}`,
  );

  if (!response.ok) return;

  const text = await response.text();

  map.set(`/${name}`, text);

  await Promise.all(
    [...text.matchAll(LIB_REFERENCE)].map(([, lib]) =>
      collectLib(map, `lib.${lib}.d.ts`, seen),
    ),
  );
}

// Version-pinned and cached; shared across every sandbox so switching examples
// never re-downloads lib.*.d.ts.
let libMap: Promise<Map<string, string>> | undefined;

const getLibMap = () =>
  (libMap ??= (async () => {
    const map = new Map<string, string>();
    const seen = new Set<string>();

    await Promise.all(
      COMPILER_OPTIONS.lib!.map((name) => collectLib(map, name, seen)),
    );

    return map;
  })());

export interface TsEnv {
  env: VirtualTypeScriptEnvironment;
  sync(files: Record<string, string>): void;
}

export async function createTsEnv(
  files: Record<string, string>,
): Promise<TsEnv> {
  const map = new Map(await getLibMap());

  // CSS (and other asset) imports would otherwise surface as phantom missing-module errors.
  map.set('/globals.d.ts', "declare module '*.css';\n");

  const known = new Set(['/globals.d.ts']);
  const roots = ['/globals.d.ts'];

  for (const [path, code] of Object.entries(files)) {
    map.set(path, code);
    known.add(path);
    if (CODE_FILE.test(path)) roots.push(path);
  }

  const env = createVirtualTypeScriptEnvironment(
    createSystem(map),
    roots,
    ts,
    COMPILER_OPTIONS,
  );

  // Pull @types for react / @expressive / any other imported package from the
  // CDN; each resolved file drops into the VFS so completions gain real types.
  const acquire = setupTypeAcquisition({
    projectName: 'expressive-sandbox',
    typescript: ts,
    delegate: {
      receivedFile(code, path) {
        if (env.getSourceFile(path)) env.updateFile(path, code);
        else env.createFile(path, code);
      },
    },
  });

  const source = () =>
    Object.entries(files)
      .filter(([path]) => CODE_FILE.test(path))
      .map(([, code]) => code)
      .join('\n');

  acquire(source());

  return {
    env,
    sync(next) {
      for (const [path, code] of Object.entries(next)) {
        if (!CODE_FILE.test(path)) continue;
        if (known.has(path)) env.updateFile(path, code);
        else {
          env.createFile(path, code);
          known.add(path);
        }
      }
    },
  };
}
