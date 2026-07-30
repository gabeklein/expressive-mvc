import './App.css';

import State, { ref } from '@expressive/react';

const FIELDS = [
  { key: 'first', label: 'First name' },
  { key: 'last', label: 'Last name' },
  { key: 'email', label: 'Email' }
] as const;

class Profile extends State {
  first = '';
  last = '';
  email = '';

  refs = ref(this);

  clear() {
    for (const { key } of FIELDS)
      this.refs[key]('');
  }
}

function Form() {
  const profile = Profile.use();
  const { refs } = profile;
  const filled = FIELDS.filter(({ key }) => profile[key]).length;

  return (
    <div className="container form">
      <div className="fields">
        {FIELDS.map(({ key, label }) => (
          <label key={key}>
            {label}
            <input
              value={profile[key]}
              onChange={(e) => refs[key](e.target.value)}
            />
          </label>
        ))}
      </div>

      <footer>
        <small>{filled} of {FIELDS.length} filled</small>
        <button onClick={() => profile.clear()}>Clear all</button>
      </footer>
    </div>
  );
}

export default () => <Form />;
