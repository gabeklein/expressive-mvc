import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { EditorState } from '@codemirror/state';
import { EditorView, drawSelection, lineNumbers } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { css } from '@codemirror/lang-css';
import { tags as t } from '@lezer/highlight';

import { Control, type HandleProps } from './Control';
import styles from './Code.module.css';
import { filesFor, type Source } from '../pages';

// Colors are CSS variables (see Code.module.css) so the editor follows the
// app's light/dark theme with no JS swap.
const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.moduleKeyword, t.controlKeyword, t.operatorKeyword], color: 'var(--syn-keyword)' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--syn-string)' },
  { tag: [t.comment], color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: [t.number, t.bool, t.null], color: 'var(--syn-number)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--syn-func)' },
  { tag: [t.typeName, t.className, t.namespace, t.definition(t.typeName)], color: 'var(--syn-type)' },
  { tag: [t.propertyName, t.attributeName], color: 'var(--syn-prop)' },
  { tag: [t.tagName, t.angleBracket], color: 'var(--syn-tag)' },
  { tag: [t.operator, t.punctuation, t.separator], color: 'var(--syn-punct)' }
]);

const theme = EditorView.theme({
  '&': { backgroundColor: 'transparent', color: 'var(--fg-soft)' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)', lineHeight: '1.6' },
  // Opaque (matches the panel) so horizontally-scrolled code slides behind
  // the sticky gutter instead of showing through the line numbers.
  '.cm-gutters': { backgroundColor: 'var(--surface)', border: 'none', color: 'var(--muted)' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 var(--s3) 0 var(--s4)' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'transparent' },
  // Full line-height selection blocks (via drawSelection) so consecutive
  // highlighted lines touch. Override both states decisively - the base theme
  // ships a light-mode default (#d7d4f0) that otherwise wins in dark mode.
  '.cm-selectionBackground': {
    background: 'var(--cm-selection) !important'
  },
  '&.cm-focused .cm-selectionBackground': {
    background: 'var(--cm-selection) !important'
  },
  // Read-only viewer: keep selection, drop the caret entirely.
  '.cm-cursorLayer': { display: 'none' },
  '.cm-cursor, .cm-dropCursor': { display: 'none !important' },
  '.cm-content': { caretColor: 'transparent' },
  '&.cm-focused': { outline: 'none' }
});

const stateFor = (file: Source) =>
  EditorState.create({
    doc: file.code,
    extensions: [
      lineNumbers(),
      drawSelection(),
      EditorState.readOnly.of(true),
      syntaxHighlighting(highlight),
      file.lang === 'css' ? css() : javascript({ jsx: true, typescript: true }),
      theme
    ]
  });

function Editor({ file }: { file: Source }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const view = new EditorView({ state: stateFor(file), parent: host.current! });
    return () => view.destroy();
  }, [file]);

  return <div className={styles.editor} ref={host} />;
}

// Resizable split powered by the copied Control engine; each half is a plain
// Pane that ignores the index/parent props Control injects into its children.
export class Panel extends Control {
  Handle = Handle;
  collapsed = false;

  render() {
    const grid = this.collapsed ? `${styles.grid} ${styles.collapsed}` : styles.grid;

    return (
      <>
        <div className={grid} ref={this.container}>
          {this.output}
        </div>
        {this.collapsed && (
          <button
            className={styles.reveal}
            type="button"
            aria-label="Show code"
            onClick={() => (this.collapsed = false)}>
            <ChevronRight size={14} aria-hidden="true" />
            Code
          </button>
        )}
      </>
    );
  }
}

function Handle(props: HandleProps) {
  return (
    <div className={styles.handle} onMouseDown={props.grab}>
      <div className={styles.handleBar} />
      {props.active && (
        <div
          className={styles.dragMask}
          style={{ cursor: props.vertical ? 'col-resize' : 'row-resize' }}
        />
      )}
    </div>
  );
}

function Pane({ children }: { children?: ReactNode }) {
  return <div className={styles.pane}>{children}</div>;
}

function SourceView({ path }: { path: string }) {
  const files = useMemo(() => filesFor(path), [path]);
  const [active, setActive] = useState(0);

  useEffect(() => setActive(0), [path]);

  const file = files[Math.min(active, files.length - 1)];

  return (
    <div className={styles.source}>
      <div className={styles.head}>
        <div className={styles.tabs}>
          {files.map((f, i) => (
            <button
              key={f.name}
              type="button"
              className={i === active ? styles.tabActive : styles.tab}
              onClick={() => setActive(i)}>
              {f.name}
            </button>
          ))}
        </div>
        <Collapse />
      </div>
      <Editor file={file} />
    </div>
  );
}

function Collapse() {
  const panel = Panel.get();

  return (
    <button
      className={styles.collapse}
      type="button"
      aria-label="Hide source"
      onClick={() => (panel.collapsed = true)}>
      <ChevronLeft size={14} aria-hidden="true" />
    </button>
  );
}

// Source on the left, the example (iframe) on the right, a draggable divider
// between. Falls back to the bare example when there are no source files.
export default function Code({ path, children }: { path: string; children: ReactNode }) {
  const files = useMemo(() => filesFor(path), [path]);

  if (!files.length) return <>{children}</>;

  return (
    <Panel row>
      <Pane>
        <SourceView path={path} />
      </Pane>
      <Pane>{children}</Pane>
    </Panel>
  );
}
