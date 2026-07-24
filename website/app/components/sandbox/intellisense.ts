import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import type { Extension } from '@codemirror/state';
import { hoverTooltip, type Tooltip } from '@codemirror/view';
import ts from 'typescript';

import type { TsEnv } from './tsEnv';

const COMPLETION_TYPE: Record<string, Completion['type']> = {
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

function tooltipDom(main: string, doc?: string) {
  const dom = document.createElement('div');
  dom.className = 'sp-ts-tooltip';

  const signature = dom.appendChild(document.createElement('code'));
  signature.className = 'sp-ts-signature';
  signature.textContent = main;

  if (doc) {
    const body = dom.appendChild(document.createElement('div'));
    body.className = 'sp-ts-doc';
    body.textContent = doc;
  }

  return dom;
}

/**
 * CodeMirror IntelliSense backed by the virtual TypeScript language service.
 * `getEnv` resolves the (async, lazily-built) env for the current sandbox and
 * `getPath` names the file this editor instance is showing.
 */
export function intellisense(
  getEnv: () => Promise<TsEnv> | undefined,
  getPath: () => string,
): Extension {
  const sync = async (doc: string) => {
    const holder = await getEnv();
    if (!holder) return undefined;

    const path = getPath();
    if (holder.env.getSourceFile(path)) holder.env.updateFile(path, doc);
    else holder.env.createFile(path, doc);

    return { env: holder.env, path };
  };

  const complete = async (
    ctx: CompletionContext,
  ): Promise<CompletionResult | null> => {
    const before = ctx.state.doc.sliceString(Math.max(0, ctx.pos - 1), ctx.pos);
    const word = ctx.matchBefore(/[\w$]+/);

    if (!ctx.explicit && !word && before !== '.') return null;

    const ready = await sync(ctx.state.doc.toString());
    if (!ready) return null;

    const { env, path } = ready;
    const info = env.languageService.getCompletionsAtPosition(path, ctx.pos, {
      includeCompletionsForModuleExports: true,
      includeCompletionsWithInsertText: true,
    });

    if (!info || !info.entries.length) return null;

    let from = word ? word.from : ctx.pos;
    let to = ctx.pos;

    if (info.optionalReplacementSpan) {
      from = info.optionalReplacementSpan.start;
      to = from + info.optionalReplacementSpan.length;
    }

    const options: Completion[] = info.entries.map((entry) => ({
      label: entry.name,
      type: COMPLETION_TYPE[entry.kind],
      info() {
        const detail = env.languageService.getCompletionEntryDetails(
          path,
          ctx.pos,
          entry.name,
          undefined,
          entry.source,
          undefined,
          entry.data,
        );

        if (!detail) return null;

        return tooltipDom(
          ts.displayPartsToString(detail.displayParts),
          ts.displayPartsToString(detail.documentation),
        );
      },
    }));

    return { from, to, options, validFor: /^[\w$]*$/ };
  };

  const hover = hoverTooltip(async (view, pos): Promise<Tooltip | null> => {
    const ready = await sync(view.state.doc.toString());
    if (!ready) return null;

    const { env, path } = ready;
    const quick = env.languageService.getQuickInfoAtPosition(path, pos);
    if (!quick) return null;

    const main = ts.displayPartsToString(quick.displayParts);
    if (!main) return null;

    return {
      pos: quick.textSpan.start,
      end: quick.textSpan.start + quick.textSpan.length,
      create: () => ({
        dom: tooltipDom(main, ts.displayPartsToString(quick.documentation)),
      }),
    };
  });

  return [autocompletion({ override: [complete] }), hover];
}
