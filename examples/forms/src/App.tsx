import './App.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import Form from './Demo';

const App = () => (
  <div className="container">
    <h1>Simple Example: Form</h1>
    <Form />
  </div>
)

createRoot(
  document.getElementById('root')!
).render(<App />)
