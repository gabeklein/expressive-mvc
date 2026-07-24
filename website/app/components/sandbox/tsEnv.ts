import { setupTypeAcquisition } from '@typescript/ata';
import {
  createDefaultMapFromCDN,
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

// CDN lib fetch is version-pinned and localStorage-cached; share it across
// every sandbox so switching examples never re-downloads lib.*.d.ts.
let libMap: Promise<Map<string, string>> | undefined;

const getLibMap = () =>
  (libMap ??= createDefaultMapFromCDN(
    COMPILER_OPTIONS,
    ts.version,
    true,
    ts,
  ));

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
