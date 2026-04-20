import {
  Sandpack,
  SandpackCodeEditor,
  useSandpack
} from '@codesandbox/sandpack-react';
import { useTheme } from 'next-themes';
import { examples, base } from 'virtual:examples';
import { Panel } from './layout/Layout';

function Sandbox({ name }: { name: string }) {
  const theme = useTheme().theme as "dark" | "light";

  Sandpack: {
    height: 600;
  }

  return (
    <Sandpack
      theme={theme}
      template="react-ts"
      files={getFiles(name)}
      customSetup={{
        dependencies: { '@expressive/react': 'latest' }
      }}
    />
  );
}

export default Sandbox;

function Editor(){
  const { dispatch } = useSandpack();

  return (
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
  )
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
