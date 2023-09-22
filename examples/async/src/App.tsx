import './App.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import Situation from './Situation';

const App = () => (
  <div className="container">
    <h1>Simple Example: Async</h1>
    <Situation />
  </div>
)

createRoot(
  document.getElementById('root')
).render(<App />);