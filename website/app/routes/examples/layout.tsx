import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { NavLink, Outlet } from 'react-router';

import { layoutOptions } from '../home';
import { NAMES } from './loader';
import { useState } from 'react';

export function meta() {
  return [{ title: 'Examples - Expressive' }];
}

export default function ExamplesLayout() {
  content: {
    display: flex;
    flexDirection: column;
    flex: 1;
    padding: 24;
    gap: 16;
    maxWidth: 1400;
    width: fill;
    margin: 0, auto;
  }

  return (
    <HomeLayout {...layoutOptions}>
      <div _content>
        <Navigation />
        <Outlet />
      </div>
    </HomeLayout>
  );
}

function Navigation() {
  display: flex;
  flexWrap: wrap;
  gap: 8;

  NavLink: {
    padding: 6, 12;
    borderRadius: 6;
    border: $colorFdBorder;
    fontSize: 0.875;
    textDecoration: none;
    color: inherit;
    userSelect: none;

    $hover: {
      borderColor: $colorFdPrimary;
    }

    if("[aria-current='page']") {
      background: $colorFdPrimary;
      color: $colorFdPrimaryForeground;
      borderColor: $colorFdPrimary;
    }
  }

  const [active, setActive] = useState<boolean>(false);

  Button: {
    color: red;

    $hover: {
      color: green;
    }

    if(active)
      color: purple;
      
      fontWeight: bold;
  }

  return (
    <nav>
      {NAMES.map((name) => (
        <NavLink key={name} to={`/examples/${name}`}>
          {name}
        </NavLink>
      ))}
      <Button onClick={() => {
        setActive(true)
      }} />
    </nav>
  );
}

const Button = ({ onClick }: {
  onClick: () => void;
}) => {
  padding: 6, 12;
  borderRadius: 6;
  border: $colorFdBorder;
  fontSize: 0.875;
  textDecoration: none;
  color: inherit;
  userSelect: none;

  $hover: {
    borderColor: $colorFdPrimary;
  }

  return <button onClick={onClick}>Example</button>;
}