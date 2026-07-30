import './Notes.css';

import type { ReactNode } from 'react';

const INLINE = /(\*\*.+?\*\*|\*[^*]+\*|`.+?`|\[.+?\]\(.+?\))/g;
const LINK = /^\[(.+?)\]\((.+?)\)$/;

const inline = (text: string): ReactNode[] =>
  text.split(INLINE).map((part, i) => {
    if (part.startsWith('**'))
      return <strong key={i}>{inline(part.slice(2, -2))}</strong>;

    if (part.startsWith('*')) return <em key={i}>{inline(part.slice(1, -1))}</em>;
    if (part.startsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;

    const link = LINK.exec(part);

    return link ? <a key={i} href={link[2]}>{link[1]}</a> : part;
  });

const block = (text: string, i: number) => {
  if (text.startsWith('- '))
    return (
      <ul key={i}>
        {text.split(/\n(?=- )/).map((item, j) => (
          <li key={j}>{inline(item.slice(2).replace(/\n\s+/g, ' '))}</li>
        ))}
      </ul>
    );

  return <p key={i}>{inline(text.replace(/\n/g, ' '))}</p>;
};

export default ({ children }: { children: string }) => {
  const source = children.trim();
  const heading = /^#\s+(.*)\n+/.exec(source);

  return (
    <details className="notes" open>
      <summary>{heading ? heading[1] : 'About this example'}</summary>
      <div className="notes-body">
        {(heading ? source.slice(heading[0].length) : source)
          .split(/\n{2,}/)
          .map(block)}
      </div>
    </details>
  );
};
