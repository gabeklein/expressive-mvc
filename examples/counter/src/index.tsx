import './index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import Counter from './Counter';

createRoot(
  document.getElementById('root')
).render(
  <div className="container">
    <h1>Simplest Example: Counter</h1>
    <Counter />
  </div>
);