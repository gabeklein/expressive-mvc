import './index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import SignupForm from './SignupForm';

createRoot(document.getElementById('root')!).render(
  <div className="container">
    <h1>Form Management Example</h1>
    <p>Generic form state management with validation</p>
    <SignupForm />
  </div>
);
