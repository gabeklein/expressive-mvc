import './App.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import SayHello from './SayHello';

const App = () => (
  <div className="container">
    <h1>Simple Example: Fetch</h1>
    <SayHello />
  </div>
)

createRoot(
  document.getElementById('root')
).render(<App />)
