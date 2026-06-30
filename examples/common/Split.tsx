import './Split.css';

import type { ReactNode } from 'react';

// A responsive row: children sit side by side with a separator between
// them, and stack vertically (separator flips to a top border) when
// space runs out.
export default ({ children }: { children: ReactNode }) => (
  <div className="split">{children}</div>
);
