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

  // Computed
  isFirstStep = set(this, (state) => state.currentStep === 0);
  isLastStep = set(
    this,
    (state) => state.currentStep === state.steps.length - 1
  );
  canProceed = set(this, (state) => {
    // Add validation logic based on current step
    switch (state.currentStep) {
      case 0: // Account
        return state.data.username.length >= 3 && state.data.email.includes('@');
      case 1: // Profile
        return state.data.displayName.length >= 2;
      case 2: // Preferences
        return true;
      case 3: // Review
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

function AccountStep({ data }: { data: WizardState['data'] }) {
  const wizard = WizardState.get();
  return (
    <div className="step-content">
      <div className="form-field">
        <label>Username</label>
        <input
          type="text"
          value={data.username}
          onChange={(e) => (wizard.is.data.username = e.target.value)}
          placeholder="Enter username (min 3 chars)"
        />
      </div>
      <div className="form-field">
        <label>Email</label>
        <input
          type="email"
          value={data.email}
          onChange={(e) => (wizard.is.data.email = e.target.value)}
          placeholder="Enter your email"
        />
      </div>
    </div>
  );
}

function ProfileStep({ data }: { data: WizardState['data'] }) {
  const wizard = WizardState.get();
  return (
    <div className="step-content">
      <div className="form-field">
        <label>Display Name</label>
        <input
          type="text"
          value={data.displayName}
          onChange={(e) => (wizard.is.data.displayName = e.target.value)}
          placeholder="Enter display name (min 2 chars)"
        />
      </div>
    </div>
  );
}

function PreferencesStep({ data }: { data: WizardState['data'] }) {
  const wizard = WizardState.get();
  return (
    <div className="step-content">
      <div className="form-field">
        <label>Theme</label>
        <select
          value={data.theme}
          onChange={(e) =>
            (wizard.is.data.theme = e.target.value as 'light' | 'dark')
          }>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>
    </div>
  );
}

function ReviewStep({ data }: { data: WizardState['data'] }) {
  return (
    <div className="step-content">
      <div className="review-section">
        <h3>Account Information</h3>
        <p>
          <strong>Username:</strong> {data.username}
        </p>
        <p>
          <strong>Email:</strong> {data.email}
        </p>
      </div>
      <div className="review-section">
        <h3>Profile Information</h3>
        <p>
          <strong>Display Name:</strong> {data.displayName}
        </p>
      </div>
      <div className="review-section">
        <h3>Preferences</h3>
        <p>
          <strong>Theme:</strong> {data.theme}
        </p>
      </div>
    </div>
  );
}

function getStepComponent(step: number) {
  switch (step) {
    case 0:
      return AccountStep;
    case 1:
      return ProfileStep;
    case 2:
      return PreferencesStep;
    case 3:
      return ReviewStep;
    default:
      return AccountStep;
  }
}

function WizardApp() {
  const wizard = WizardState.use();
  const CurrentStepComponent = getStepComponent(wizard.currentStep);

  return (
    <div className="wizard">
      <div className="wizard-header">
        <div className="steps-indicator">
          {wizard.steps.map((step, index) => (
            <div
              key={step}
              className={`step-indicator ${
                index === wizard.currentStep ? 'active' : ''
              } ${index < wizard.currentStep ? 'completed' : ''}`}>
              <div className="step-number">{index + 1}</div>
              <div className="step-label">{step}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="wizard-body">
        <h2>{wizard.steps[wizard.currentStep]}</h2>
        <CurrentStepComponent data={wizard.data} />
      </div>

      <div className="wizard-footer">
        {!wizard.isFirstStep && (
          <button onClick={wizard.previous} className="btn-secondary">
            Back
          </button>
        )}
        {!wizard.isLastStep ? (
          <button
            onClick={wizard.next}
            disabled={!wizard.canProceed}
            className="btn-primary">
            Next
          </button>
        ) : (
          <button
            onClick={wizard.submit}
            disabled={!wizard.canProceed}
            className="btn-primary">
            Submit
          </button>
        )}
      </div>
    </div>
  );
}

export default WizardApp;
