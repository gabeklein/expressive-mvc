import './index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import UserProfile from './Demo';

createRoot(document.getElementById('root')!).render(
  <div className="container">
    <h1>Nested States: Fine-Grained Reactivity</h1>
    <UserProfile />
  </div>
);
