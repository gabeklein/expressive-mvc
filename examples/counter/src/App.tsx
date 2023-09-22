import './App.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import Counter from './Counter';

const App = () => (
  <div className="container">
    <h1>Simple Example: Counter</h1>
    <Counter />
  </div>
)

createRoot(
  document.getElementById('root')
).render(<App />);