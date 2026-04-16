import { Component, State } from '@expressive/react';

class Profile extends State {
  name = 'John';
  email = 'john@example.com';
}

class Settings extends State {
  theme: 'light' | 'dark' = 'light';
  language = 'en';
}

// Extending Component makes UserData self-providing - rendering <UserData>
// puts it in context for any descendant calling UserData.get().
class UserData extends Component {
  // Children created with `new` are owned by this state and provided
  // to descendants automatically - Settings.get() works anywhere below.
  profile = new Profile();
  settings = new Settings();

  notifications = 0;
}

export { UserData, Settings, Profile };
