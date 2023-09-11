import './index.css';

import { createRoot } from 'react-dom/client';

import Counter from './Counter';

const App = () => (
  <div className="container">
    <h1>Simplest Example: Counter</h1>
    <Counter />
  </div>
)

createRoot(
  document.getElementById('root')
).render(<App />)
