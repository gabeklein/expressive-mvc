import State from '@expressive/react';

class Form<T extends Record<string, any>> extends State {
  values: T;
  errors: Partial<Record<keyof T, string>> = {};
  touched: Partial<Record<keyof T, boolean>> = {};

  constructor(initial: T) {
    super();
    this.values = initial;
  }

  setValue<K extends keyof T>(key: K, value: T[K]) {
    this.values = { ...this.values, [key]: value };
    this.touched[key] = true;
  }

  setError<K extends keyof T>(key: K, error: string) {
    this.errors = { ...this.errors, [key]: error };
  }

  validate(rules: Partial<Record<keyof T, (val: any) => string | null>>) {
    for (const key in rules) {
      const error = rules[key]!(this.values[key]);
      if (error) this.setError(key, error);
    }
  }
}

function SignupForm() {
  const form = Form.use({
    username: '',
    email: '',
    password: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    form.validate({
      username: (val) => (val.length < 3 ? 'Too short' : null),
      email: (val) => (!val.includes('@') ? 'Invalid email' : null),
      password: (val) => (val.length < 8 ? 'Too weak' : null)
    });

    if (Object.keys(form.errors).length === 0) {
      console.log('Form submitted:', form.values);
      alert('Form submitted successfully!');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="signup-form">
      <div className="form-field">
        <label htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          value={form.values.username}
          onChange={(e) => form.setValue('username', e.target.value)}
          className={form.errors.username ? 'error' : ''}
        />
        {form.errors.username && (
          <span className="error-message">{form.errors.username}</span>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={form.values.email}
          onChange={(e) => form.setValue('email', e.target.value)}
          className={form.errors.email ? 'error' : ''}
        />
        {form.errors.email && (
          <span className="error-message">{form.errors.email}</span>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={form.values.password}
          onChange={(e) => form.setValue('password', e.target.value)}
          className={form.errors.password ? 'error' : ''}
        />
        {form.errors.password && (
          <span className="error-message">{form.errors.password}</span>
        )}
      </div>

      <button type="submit">Sign Up</button>
    </form>
  );
}

export default SignupForm;
