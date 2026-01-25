import State from '@expressive/react';

// Nested states demonstrate fine-grained reactivity.
// Components only re-render when accessed properties change.

class Profile extends State {
  name = 'John';
  email = 'john@example.com';
}

class Settings extends State {
  theme = 'light';
  language = 'en';
}

class UserData extends State {
  profile = new Profile();
  settings = new Settings();
  notifications = 0;
}

const UserProfile = () => {
  const {
    profile: { name, email },
    notifications
  } = UserData.use();

  // Only re-renders when name, email, or notifications change
  // Changes to settings.theme won't affect this component!
  return (
    <div className="card">
      <h2>{name}</h2>
      <p>{email}</p>
      <span>{notifications} notifications</span>
    </div>
  );
};

export default UserProfile;
