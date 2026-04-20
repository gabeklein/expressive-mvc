import {
  SandpackCodeEditor,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack
} from '@codesandbox/sandpack-react';
import State from '@expressive/react';
import { examples, base } from 'virtual:examples';

const DARK = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;

class Theme extends State {
  dark = DARK?.matches ?? false;

  protected new() {
    if (!DARK) return;
    const onChange = () => (this.dark = DARK.matches);
    DARK.addEventListener('change', onChange);
    return () => DARK.removeEventListener('change', onChange);
  }
}

export default function Sandbox({ name }: { name: string }) {
  const { dark } = Theme.use();

  return (
    <SandpackProvider
      key={name}
      theme={dark ? 'dark' : 'light'}
      template="react-ts"
      files={getFiles(name)}
      customSetup={{
        dependencies: { '@expressive/react': 'latest' }
      }}
      style={{ height: '100%' }}>
      <Layout />
    </SandpackProvider>
  );
}

function Layout() {
  const { dispatch } = useSandpack();

  return (
    <SandpackLayout style={{ height: '100%', ['--sp-layout-height' as any]: '100%' }}>
      <SandpackCodeEditor
        extensionsKeymap={[
          {
            key: 'Mod-s',
            preventDefault: true,
            run() {
              dispatch({ type: 'refresh' });
              return true;
            }
          }
        ]}
      />
      <SandpackPreview />
    </SandpackLayout>
  );
}

function getFiles(name: string) {
  const source = examples[name];
  const files: Record<string, any> = {};

  for (const [path, code] of Object.entries(base))
    files[path] = { hidden: true, code };

  // Insertion order drives Sandpack's tab order; push CSS to the end.
  const sorted = Object.entries(source).sort(
    ([a], [b]) => Number(a.endsWith('.css')) - Number(b.endsWith('.css'))
  );

  for (const [path, code] of sorted) {
    if (path === '/index.css') continue;
    // /index.tsx is generated boilerplate from the sandbox plugin.
    files[path] = path === '/index.tsx' ? { hidden: true, code } : code;
  }

  return files;
}
