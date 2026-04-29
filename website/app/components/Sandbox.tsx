import {
  SandpackCodeEditor,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack
} from '@codesandbox/sandpack-react';
import { useTheme } from 'next-themes';
import { examples, base } from '@/lib/examples';

export default function Sandbox({ name }: { name: string }) {
  const { theme } = useTheme();

  return (
    <SandpackProvider
      key={name}
      theme={theme === "dark" ? 'dark' : 'light'}
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

  $spLayoutHeight: '100%';
  height: '100%';

  return (
    <SandpackLayout>
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
