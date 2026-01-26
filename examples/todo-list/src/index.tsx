import './index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import TodoApp from './TodoApp';

createRoot(document.getElementById('root')!).render(
  <div className="container">
    <h1>Todo List with Nested States</h1>
    <p>Demonstrates nested State instances and computed values</p>
    <TodoApp />
  </div>
);
