import './index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from '@expressive/react';

import WizardApp from './WizardApp';

// Note: WizardState needs to be imported to use with Provider
import State, { set } from '@expressive/react';

class WizardState extends State {
  currentStep = 0;
  steps = ['Account', 'Profile', 'Preferences', 'Review'];

  data = {
    username: '',
    email: '',
    displayName: '',
    theme: 'light' as 'light' | 'dark'
  };

  isFirstStep = set(this, (state) => state.currentStep === 0);
  isLastStep = set(
    this,
    (state) => state.currentStep === state.steps.length - 1
  );
  canProceed = set(this, (state) => {
    switch (state.currentStep) {
      case 0:
        return state.data.username.length >= 3 && state.data.email.includes('@');
      case 1:
        return state.data.displayName.length >= 2;
      case 2:
      case 3:
        return true;
      default:
        return false;
    }
  });

  next() {
    if (!this.isLastStep && this.canProceed) {
      this.currentStep++;
    }
  }

  previous() {
    if (!this.isFirstStep) {
      this.currentStep--;
    }
  }

  submit() {
    if (this.isLastStep && this.canProceed) {
      console.log('Submitting:', this.data);
      alert('Wizard completed! Check console for submitted data.');
    }
  }
}

createRoot(document.getElementById('root')!).render(
  <div className="container">
    <h1>Multi-Step Wizard Example</h1>
    <p>Step-by-step form with validation and computed properties</p>
    <Provider for={WizardState}>
      <WizardApp />
    </Provider>
  </div>
);
