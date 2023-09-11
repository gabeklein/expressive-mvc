import './App.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import MyForm from './MyForm';

const App = () => (
  <div className="container">
    <h1>Example Form</h1>
    <MyForm />
  </div>
)

createRoot(
  document.getElementById('root')!
).render(<App />)
