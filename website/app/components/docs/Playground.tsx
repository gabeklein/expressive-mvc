import { Link } from 'react-router';
import { examples, getFiles } from '@/routes/examples/loader';
import Sandbox from '@/components/Sandbox';

interface PlaygroundProps {
  of: string;
  height?: number;
}

export default function Playground({ of, height = 480 }: PlaygroundProps) {
  if (!examples[of])
    throw new Error(`No example found for <Playground of="${of}" />`);

  return (
    <div className="not-prose my-6">
      <div
        style={{ height }}
        className="relative overflow-hidden rounded-xl border border-fd-border">
        <div className="absolute inset-0 flex flex-col">
          <Sandbox name={of} files={getFiles(of)} />
        </div>
      </div>
      <div className="mt-2 text-right">
        <Link
          className="text-sm text-fd-muted-foreground no-underline hover:text-fd-foreground"
          to={`/examples/${of}`}>
          Open in Playground →
        </Link>
      </div>
    </div>
  );
}
