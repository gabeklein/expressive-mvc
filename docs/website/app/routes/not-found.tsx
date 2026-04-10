import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { Link } from 'react-router';
import { layoutOptions } from './docs';

export function meta() {
  return [{ title: 'Not Found' }];
}

export default function NotFound() {
  content: {
    padding: 16;
    display: flex;
    flexDirection: column;
    alignItems: center;
    justifyContent: center;
    textAlign: center;
    flex: 1;

    h1: {
      fontSize: 1.25;
      fontWeight: bold;
      marginBottom: 8;
    }

    p: {
      color: $colorFdMutedForeground;
      marginBottom: 16;
    }

    Link: {
      fontSize: 0.875;
      background: $colorFdPrimary;
      color: $colorFdPrimaryForeground;
      radius: round;
      fontWeight: 500;
      padding: 10, 16;
      textDecoration: none;
    }
  }

  return (
    <HomeLayout {...layoutOptions}>
      <div _content>
        <h1>Not Found</h1>
        <p>This page could not be found.</p>
        <Link to="/docs">Back to Docs</Link>
      </div>
    </HomeLayout>
  );
}
