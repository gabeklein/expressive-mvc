import './index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import Situation from './Situation';

createRoot(
  document.getElementById('root')
).render(
  <div className="container">
    <h1>Simplest Example: Async</h1>
    <Situation />
  </div>
);