import './App.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import MyForm from './MyForm';

createRoot(
  document.getElementById('root')!
).render(<MyForm />)
