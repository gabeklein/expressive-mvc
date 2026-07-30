// Kept out of pages.ts on purpose: the website imports that module, and its
// fumadocs-mdx plugin claims every `*.md` id (query and all), so a raw glob
// for README.md there compiles to an MDX component instead of a string. The
// website reads the same files through its own `virtual:example-notes`.
const notes = import.meta.glob('./pages/**/README.md', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

/** An example's README.md, keyed by its App.tsx module id. */
export const notesFor = (file: string): string | undefined =>
  notes[file.replace(/App\.tsx$/, 'README.md')];
