import {
  acceptCompletion,
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import { Prec, type Extension } from '@codemirror/state';
import {
  EditorView,
  hoverTooltip,
  keymap,
  tooltips,
  type Tooltip,
} from '@codemirror/view';

import type { SandboxTs } from './client';

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
 * CodeMirror IntelliSense backed by the worker language service. `getClient`
 * resolves (and lazily spawns) the worker for the current sandbox; `getPath`
 * names the file this editor instance is showing.
 */
export function intellisense(
  getClient: () => SandboxTs | undefined,
  getPath: () => string,
): Extension {
  const complete = async (
    ctx: CompletionContext,
  ): Promise<CompletionResult | null> => {
    const before = ctx.state.doc.sliceString(Math.max(0, ctx.pos - 1), ctx.pos);
    const word = ctx.matchBefore(/[\w$]+/);

    if (!ctx.explicit && !word && before !== '.') return null;

    const client = getClient();
    if (!client) return null;

    const path = getPath();
    const res = await client.complete(path, ctx.state.doc.toString(), ctx.pos);

    if (ctx.aborted || !res || !res.entries.length) return null;

    let from = word ? word.from : ctx.pos;
    let to = ctx.pos;

    if (res.replacement) {
      from = res.replacement.start;
      to = from + res.replacement.length;
    }

    const options: Completion[] = res.entries.map((entry) => ({
      label: entry.name,
      type: entry.type,
      async info() {
        const detail = await client.details(
          path,
          ctx.pos,
          entry.name,
          entry.source,
          entry.data,
        );

        return detail ? tooltipDom(detail.display, detail.documentation) : null;
      },
    }));

    return { from, to, options, validFor: /^[\w$]*$/ };
  };

  const hover = hoverTooltip(async (view, pos): Promise<Tooltip | null> => {
    const client = getClient();
    if (!client) return null;

    const quick = await client.quickInfo(
      getPath(),
      view.state.doc.toString(),
      pos,
    );

    if (!quick || !quick.display) return null;

    return {
      pos: quick.span.start,
      end: quick.span.start + quick.span.length,
      create: () => ({
        dom: tooltipDom(quick.display, quick.documentation),
      }),
    };
  });

  return [
    // Tooltips default to living inside the editor, where they stretch its
    // scrollable area and get clipped at its edge. Float them at the document
    // root instead: <body> hosts the app's own stacking context, which paints
    // over any tooltip parented there - parenting to <html> escapes it. Absolute,
    // not fixed - fixed sends Safari into a measure-and-reflip flicker.
    tooltips({ position: 'absolute', parent: document.documentElement }),
    // Tab accepts the highlighted completion (like an editor); acceptCompletion
    // returns false when no popup is open, so Tab still indents otherwise.
    Prec.highest(keymap.of([{ key: 'Tab', run: acceptCompletion }])),
    // Warm the worker the moment the editor is focused, so its multi-second
    // first-load (worker chunk + CDN libs) overlaps with the user reading and
    // typing rather than stalling the first completion.
    EditorView.domEventHandlers({
      focus() {
        getClient();
        return false;
      },
    }),
    autocompletion({ override: [complete] }),
    hover,
  ];
}
