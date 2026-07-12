import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';

interface Edit {
  file: string;
  line: number;
  endLine: number;
  original: string;
  updated: string;
}

function editorEnabled(search: string) {
  return (
    import.meta.env.DEV &&
    new URLSearchParams(search).get('edit') === 'true'
  );
}

export default function InlineEditor() {
  const location = useLocation();
  const active = editorEnabled(location.search);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;

    const edits = new Map<string, Edit>();
    const originals = new WeakMap<HTMLElement, string>();
    const cleanups: (() => void)[] = [];

    const record = (el: HTMLElement) => {
      const key = `${el.dataset.src}:${el.dataset.ln}`;
      edits.set(key, {
        file: el.dataset.src!,
        line: Number(el.dataset.ln),
        endLine: Number(el.dataset.le),
        original: originals.get(el) ?? el.innerText,
        updated: el.innerText
      });
    };

    const attach = () => {
      const stamped = Array.from(
        document.querySelectorAll<HTMLElement>('[data-src][data-ln]')
      );
      const leaves = stamped.filter(
        (el) => !el.querySelector('[data-src]')
      );

      for (const el of leaves) {
        if (el.dataset.editing) continue;
        el.dataset.editing = 'true';
        el.setAttribute('contenteditable', 'plaintext-only');
        el.spellcheck = false;
        originals.set(el, el.innerText);

        const onInput = () => record(el);
        el.addEventListener('input', onInput);
        cleanups.push(() => {
          el.removeEventListener('input', onInput);
          el.removeAttribute('contenteditable');
          delete el.dataset.editing;
        });
      }
    };

    const save = async () => {
      const changed = [...edits.values()].filter(
        (e) => e.updated.trim() !== e.original.trim()
      );

      if (!changed.length) {
        setStatus('No changes to save');
        return;
      }

      try {
        const res = await fetch('/__edit', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ edits: changed })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setStatus(
          `Wrote ${changed.length} edit(s) to website/.edits/pending.md`
        );
      } catch (err) {
        setStatus(`Save failed: ${String(err)}`);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void save();
      }
    };

    let scheduled = 0;
    const schedule = () => {
      cancelAnimationFrame(scheduled);
      scheduled = requestAnimationFrame(attach);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();
    window.addEventListener('keydown', onKey);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(scheduled);
      window.removeEventListener('keydown', onKey);
      for (const fn of cleanups) fn();
    };
  }, [active, location.pathname]);

  useEffect(() => {
    if (!status) return;
    const id = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(id);
  }, [status]);

  if (!active) return null;

  return (
    <>
      <style>{`
        [data-editing] {
          outline: 1px dashed color-mix(in oklab, var(--color-fd-primary) 45%, transparent);
          outline-offset: 3px;
          border-radius: 2px;
          transition: outline-color 0.15s;
        }
        [data-editing]:focus {
          outline: 2px solid var(--color-fd-primary);
          outline-offset: 3px;
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          bottom: '1rem',
          right: '1rem',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.5rem 0.85rem',
          borderRadius: '0.75rem',
          fontSize: '0.8rem',
          fontWeight: 500,
          color: 'var(--color-fd-primary-foreground)',
          background: 'var(--color-fd-primary)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)'
        }}>
        <span>{status ?? 'Editing docs · ⌘S / Ctrl+S to save'}</span>
      </div>
    </>
  );
}
