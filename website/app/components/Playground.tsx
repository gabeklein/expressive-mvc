import { Link } from 'react-router';

export default function Playground({ to }: { to: string }) {
  return (
    <div className="mt-4 mr-2 text-right">
      <Link
        className="text-sm text-fd-primary/50 font-medium no-underline hover:text-fd-primary"
        to={to}>
        Edit in Playground →
      </Link>
    </div>
  );
}
