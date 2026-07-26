import './App.css';

import State, { ref } from '@expressive/react';

const FIELDS = [
  { key: 'first', label: 'First name' },
  { key: 'last', label: 'Last name' },
  { key: 'email', label: 'Email' }
] as const;

// `ref(this)` is the plural form: one call hands back an imperative handle
// for *every* field, keyed by name. Each `refs.first` is a callable ref -
// `refs.first('Ada')` writes the field - so one proxy drives the whole form
// and a loop can clear every field, with no useRef per input.
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
      <h1>Ref Proxy</h1>
      <p>
        <code>ref(this)</code> exposes one callable ref per field. Every input
        writes through that proxy, and Clear loops it over all three.
      </p>

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
