import './App.css';

import { createRoot } from 'react-dom/client';

import Situation from './Situation';

const App = () => (
  <div className="container">
    <h1>Simplest Example: Async</h1>
    <Situation />
  </div>
)

createRoot(
  document.getElementById('root')
).render(<App />);