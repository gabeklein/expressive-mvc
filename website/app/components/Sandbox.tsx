import {
  SandpackCodeEditor,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack,
  useSandpackTheme
} from '@codesandbox/sandpack-react';
import State, { set } from '@expressive/react';
import { examples, base } from 'virtual:examples';
import { Panel } from './layout/Layout';
import { useTheme } from "next-themes";

class Control extends State {
  name = '';

  files = set(({ name }: this) => {
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
  })
}

function Sandbox(props: { name: string }) {
  // const { files } = Control.use(props);
  const { theme } = useTheme();

  height: '100%';
  $spLayoutHeight: "100%";

  return (
    <SandpackProvider
      key={props.name}
      theme={theme === 'dark' ? 'dark' : 'light'}
      template="react-ts"
      files={getFiles(props.name)}
      customSetup={{
        dependencies: { '@expressive/react': 'latest' }
      }}>
      <SandpackLayout>
        <Panel row>
          <Editor />
          <SandpackPreview />
        </Panel>
      </SandpackLayout> 
    </SandpackProvider>
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
