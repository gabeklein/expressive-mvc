import { useRef } from 'react';
import { Settings, UserData } from './UserData';

export default function Demo() {
  // UserData is a Component, so rendering it directly provides
  // the instance to everything inside.
  return (
    <UserData>
      <div className="container">
        <h1>Fine-Grained Reactivity Demo</h1>
        <p className="description">
          Watch the render counters! UserProfile only re-renders when you
          change name, email, or notifications. ThemeSettings only re-renders
          when you change theme or language. Each component subscribes only
          to the properties it accesses.
        </p>
        <div className="grid">
          <UserProfile />
          <ThemeSettings />
        </div>
      </div>
    </UserData>
  );
}

function UserProfile() {
  const {
    is: userData,
    notifications,
    profile: { is: profile, name, email }
  } = UserData.get();

  return (
    <div className="card">
      <RenderCount />
      <h2>User Profile</h2>
      <div className="field">
        <label>
          Name:
          <input
            type="text"
            value={name}
            onChange={(e) => (profile.name = e.target.value)}
          />
        </label>
      </div>
      <div className="field">
        <label>
          Email:
          <input
            type="email"
            value={email}
            onChange={(e) => (profile.email = e.target.value)}
          />
        </label>
      </div>
      <div className="notification-panel">
        <strong>{notifications} notifications</strong>
        <div className="button-group">
          <button onClick={() => userData.notifications++}>
            Add Notification
          </button>
          <button onClick={() => (userData.notifications = 0)}>Clear</button>
        </div>
      </div>
    </div>
  );
}

function ThemeSettings() {
  // Settings is reachable directly because UserData owns it and
  // forwards owned children to context automatically.
  const { theme, language, is: settings } = Settings.get();

  return (
    <div className={`card theme-card ${theme}`}>
      <RenderCount />
      <h2>Theme Settings</h2>
      <div className="field">
        <button
          onClick={() =>
            (settings.theme = settings.theme === 'light' ? 'dark' : 'light')
          }>
          Toggle Theme (current: {theme})
        </button>
      </div>
      <div>
        <label>
          Language:
          <select
            value={language}
            onChange={(e) => (settings.language = e.target.value)}>
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
          </select>
        </label>
      </div>
    </div>
  );
}

function RenderCount() {
  const renders = useRef(0);
  return (
    <div className="render-count">Rendered {renders.current++} times.</div>
  );
}
