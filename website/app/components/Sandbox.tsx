import {
  SandpackCodeEditor,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack
} from '@codesandbox/sandpack-react';
import { useTheme } from 'next-themes';

export default function Sandbox({
  name,
  files
}: {
  name: string;
  files: Record<string, string>;
}) {
  const { theme } = useTheme();

  return (
    <SandpackProvider
      key={name}
      theme={theme === 'dark' ? 'dark' : 'light'}
      template="react-ts"
      files={files}
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
