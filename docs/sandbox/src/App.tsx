import {
  SandpackCodeEditor,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider
} from '@codesandbox/sandpack-react';
import EXAMPLES from 'virtual:examples';
import { Navigate, NavLink, Route, Routes } from 'react-router';
import './App.css';

const NAMES = Object.keys(EXAMPLES);
const INDEX = `
import './index.css';
import { createRoot } from 'react-dom/client';
import App from './App';
createRoot(document.getElementById('root')!).render(<App />);
`;

function getFiles(name: string) {
  const source = EXAMPLES[name];
  const files: Record<string, any> = {
    '/index.tsx': {
      hidden: true,
      code: INDEX
    }
  };

  for (const [path, code] of Object.entries(source)) {
    files[path] = code;
  }

  return files;
}

function Example({ name }: { name: string }) {
  return (
    <SandpackProvider
      key={name}
      template="vite-react-ts"
      files={getFiles(name)}
      customSetup={{
        dependencies: {
          '@expressive/react': 'latest'
        }
      }}>
      <SandpackLayout>
        <SandpackCodeEditor style={{ height: '100%' }} />
        <SandpackPreview style={{ height: '100%' }} />
      </SandpackLayout>
    </SandpackProvider>
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
