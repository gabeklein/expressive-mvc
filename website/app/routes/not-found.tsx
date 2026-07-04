import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { Link } from 'react-router';
import { layoutOptions } from './home';

export function meta() {
  return [{ title: 'Not Found' }];
}

export default function NotFound() {
  return (
    <HomeLayout {...layoutOptions}>
      <div className="p-4 flex flex-col items-center justify-center text-center flex-1">
        <h1 className="text-xl font-bold mb-2">Not Found</h1>
        <p className="text-fd-muted-foreground mb-4">
          This page could not be found.
        </p>
        <Link
          to="/docs"
          className="text-sm bg-fd-primary text-fd-primary-foreground rounded-full font-medium py-2.5 px-4 no-underline">
          Back to Docs
        </Link>
      </div>
    </HomeLayout>
  );
}
