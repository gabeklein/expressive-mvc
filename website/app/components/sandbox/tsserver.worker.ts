import ts from 'typescript';

import type { Command } from './protocol';
import { createTsEnv, type TsEnv } from './tsEnv';

// TS completion kind -> CodeMirror completion `type` (its icon/class).
const COMPLETION_TYPE: Record<string, string> = {
  [ts.ScriptElementKind.constElement]: 'constant',
  [ts.ScriptElementKind.letElement]: 'variable',
  [ts.ScriptElementKind.variableElement]: 'variable',
  [ts.ScriptElementKind.localVariableElement]: 'variable',
  [ts.ScriptElementKind.parameterElement]: 'variable',
  [ts.ScriptElementKind.functionElement]: 'function',
  [ts.ScriptElementKind.localFunctionElement]: 'function',
  [ts.ScriptElementKind.memberFunctionElement]: 'method',
  [ts.ScriptElementKind.memberVariableElement]: 'property',
  [ts.ScriptElementKind.memberGetAccessorElement]: 'property',
  [ts.ScriptElementKind.memberSetAccessorElement]: 'property',
  [ts.ScriptElementKind.classElement]: 'class',
  [ts.ScriptElementKind.interfaceElement]: 'interface',
  [ts.ScriptElementKind.enumElement]: 'enum',
  [ts.ScriptElementKind.moduleElement]: 'namespace',
  [ts.ScriptElementKind.typeElement]: 'type',
  [ts.ScriptElementKind.keyword]: 'keyword',
};

// DOM lib types `self` as a Window; the Worker view exposes the single-arg
// postMessage and MessageEvent-shaped onmessage we actually want.
const ctx = self as unknown as Worker;

let ready: Promise<TsEnv> | undefined;

function feed(env: TsEnv['env'], path: string, code: string) {
  if (env.getSourceFile(path)) env.updateFile(path, code);
  else env.createFile(path, code);
}

async function handle(msg: Command): Promise<unknown> {
  if (msg.kind === 'init') {
    ready = createTsEnv(msg.files);
    await ready;
    return true;
  }

  const holder = await ready;
  if (!holder) return null;

  const { env } = holder;
  const service = env.languageService;

  switch (msg.kind) {
    case 'sync':
      holder.sync(msg.files);
      return null;

    case 'complete': {
      feed(env, msg.path, msg.code);

      const info = service.getCompletionsAtPosition(msg.path, msg.pos, {
        includeCompletionsForModuleExports: true,
        includeCompletionsWithInsertText: true,
      });

      return info
        ? {
            replacement: info.optionalReplacementSpan && {
              start: info.optionalReplacementSpan.start,
              length: info.optionalReplacementSpan.length,
            },
            entries: info.entries.map((entry) => ({
              name: entry.name,
              type: COMPLETION_TYPE[entry.kind],
              source: entry.source,
              data: entry.data,
            })),
          }
        : null;
    }

    case 'details': {
      const detail = service.getCompletionEntryDetails(
        msg.path,
        msg.pos,
        msg.name,
        undefined,
        msg.source,
        undefined,
        msg.data as ts.CompletionEntryData | undefined,
      );

      return detail
        ? {
            display: ts.displayPartsToString(detail.displayParts),
            documentation: ts.displayPartsToString(detail.documentation),
          }
        : null;
    }

    case 'quickInfo': {
      feed(env, msg.path, msg.code);

      const quick = service.getQuickInfoAtPosition(msg.path, msg.pos);

      return quick?.displayParts?.length
        ? {
            display: ts.displayPartsToString(quick.displayParts),
            documentation: ts.displayPartsToString(quick.documentation),
            span: { start: quick.textSpan.start, length: quick.textSpan.length },
          }
        : null;
    }
  }
}

ctx.onmessage = async ({ data: msg }: MessageEvent<Command & { id: number }>) => {
  try {
    ctx.postMessage({ id: msg.id, result: await handle(msg) });
  } catch (error) {
    ctx.postMessage({
      id: msg.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
