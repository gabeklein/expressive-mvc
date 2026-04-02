import {
  SandpackCodeEditor,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack
} from '@codesandbox/sandpack-react';
import State from '@expressive/react';
import EXAMPLES from 'virtual:examples';
import { Navigate, NavLink, Route, Routes } from 'react-router';
import BASE_INDEX from './base/index.tsx?raw';
import BASE_CSS from './base/styles.css?raw';
import './App.css';

const NAMES = Object.keys(EXAMPLES);
const DARK = matchMedia('(prefers-color-scheme: dark)');

class Theme extends State {
  dark = DARK.matches;

  protected new() {
    const onChange = () => (this.dark = DARK.matches);
    DARK.addEventListener('change', onChange);
    return () => DARK.removeEventListener('change', onChange);
  }
}

function getFiles(name: string) {
  const source = EXAMPLES[name];
  const files: Record<string, any> = {
    '/index.tsx': { hidden: true, code: BASE_INDEX },
    '/styles.css': { hidden: true, code: BASE_CSS }
  };

  for (const [path, code] of Object.entries(source)) {
    if (path === '/index.css') continue;
    files[path] = code;
  }

  return files;
}

function Example({ name }: { name: string }) {
  const { dark } = Theme.use();

  return (
    <SandpackProvider
      key={name}
      theme={dark ? 'dark' : 'light'}
      template="react-ts"
      files={getFiles(name)}
      customSetup={{
        dependencies: {
          '@expressive/react': 'latest'
        }
      }}>
      <ExampleLayout />
    </SandpackProvider>
  );
}

function ExampleLayout() {
  const { dispatch } = useSandpack();

  return (
    <SandpackLayout>
      <SandpackCodeEditor
        style={{ height: '100%' }}
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
      <SandpackPreview style={{ height: '100%' }} />
    </SandpackLayout>
  );
}

export default function App() {
  return (
    <div className="container">
      <h1>Expressive MVC</h1>
      <nav>
        {NAMES.map((name) => (
          <NavLink key={name} to={`/${name}`}>
            {name}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route path="/" element={<Navigate to={`/${NAMES[0]}`} replace />} />
        {NAMES.map((name) => (
          <Route
            key={name}
            path={`/${name}`}
            element={<Example name={name} />}
          />
        ))}
      </Routes>
    </div>
  );
}
