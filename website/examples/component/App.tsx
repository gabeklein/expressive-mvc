import { Toggle } from './Toggle';

// Each subclass below overrides only `render()`. State (`on`),
// behavior (`flip`), and JSX prop wiring (`label`) all come from
// Toggle - we don't have to redeclare any of it.

class Switch extends Toggle {
  render() {
    const { on, label, flip } = this;

    return (
      <label className="switch">
        <input type="checkbox" checked={on} onChange={flip} />
        <span className="track" />
        {label}
      </label>
    );
  }
}

class Pill extends Toggle {
  render() {
    const { on, label, flip } = this;

    return (
      <button className={`pill ${on ? 'on' : 'off'}`} onClick={flip}>
        {label}
      </button>
    );
  }
}

// All three share the Toggle base. State is per-instance, so each
// flips independently - we're showcasing skins, not shared logic.
const App = () => (
  <div className="container">
    <h1>Component Example</h1>
    <div className="toggles">
      <Toggle label="Default" />
      <Switch label="Switch" />
      <Pill label="Pill" />
    </div>
  </div>
);

export default App;
