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

ctx.onmessage = async ({ data: msg }: MessageEvent<Command & { id: number }>) => {
  if (msg.kind === 'init') {
    ready = createTsEnv(msg.files);
    await ready;
    ctx.postMessage({ id: msg.id, result: true });
    return;
  }

  const holder = await ready;
  let result: unknown = null;

  if (holder) {
    const { env } = holder;
    const service = env.languageService;

    switch (msg.kind) {
      case 'sync':
        holder.sync(msg.files);
        break;

      case 'complete': {
        feed(env, msg.path, msg.code);

        const info = service.getCompletionsAtPosition(msg.path, msg.pos, {
          includeCompletionsForModuleExports: true,
          includeCompletionsWithInsertText: true,
        });

        if (info)
          result = {
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
          };
        break;
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

        if (detail)
          result = {
            display: ts.displayPartsToString(detail.displayParts),
            documentation: ts.displayPartsToString(detail.documentation),
          };
        break;
      }

      case 'quickInfo': {
        feed(env, msg.path, msg.code);

        const quick = service.getQuickInfoAtPosition(msg.path, msg.pos);

        if (quick?.displayParts?.length)
          result = {
            display: ts.displayPartsToString(quick.displayParts),
            documentation: ts.displayPartsToString(quick.documentation),
            span: { start: quick.textSpan.start, length: quick.textSpan.length },
          };
        break;
      }
    }
  }

  ctx.postMessage({ id: msg.id, result });
};
