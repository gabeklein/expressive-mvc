import './App.css';

import { createRoot } from 'react-dom/client';

import SayHello from './SayHello';

const App = () => (
  <div className="container">
    <h1>Simplest Fetch Example</h1>
    <SayHello />
  </div>
)

createRoot(
  document.getElementById('root')
).render(<App />)
