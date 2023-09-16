import './App.css';

import { createRoot } from 'react-dom/client';

import MyForm from './MyForm';

createRoot(
  document.getElementById('root')!
).render(<MyForm />)
