import { Link } from 'react-router';

export default function Playground({ className = 'mt-4 mr-2 text-right', to }: { className?: string; to: string }) {
  return (
    <div className={className}>
      <Link
        className="text-sm text-fd-primary/50 font-medium no-underline hover:text-fd-primary"
        to={to}>
        See in Playground →
      </Link>
    </div>
  );
}
