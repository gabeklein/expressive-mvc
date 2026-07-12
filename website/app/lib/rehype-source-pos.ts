const EDITABLE = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'blockquote',
  'th',
  'td',
  'figcaption'
]);

function normalize(path: string) {
  if (!path) return '';
  const i = path.indexOf('content/docs');
  if (i >= 0) return 'website/' + path.slice(i);
  return path;
}

export function rehypeSourcePos() {
  return (tree: any, file: any) => {
    const path = normalize(file?.path || file?.history?.[0] || '');

    const walk = (node: any) => {
      if (node.type === 'element') {
        const pos = node.position;
        if (EDITABLE.has(node.tagName) && pos?.start?.line) {
          node.properties = node.properties || {};
          node.properties.dataSrc = path;
          node.properties.dataLn = String(pos.start.line);
          node.properties.dataLe = String(pos.end.line);
        }
        if (node.tagName === 'pre') return;
      }
      if (node.children) for (const child of node.children) walk(child);
    };

    walk(tree);
    return tree;
  };
}
