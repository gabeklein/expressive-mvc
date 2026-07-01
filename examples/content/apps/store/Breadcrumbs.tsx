import { Link } from '@expressive/router';

export interface Crumb {
  label: string;
  to?: string;
}

// A data-driven trail. The product page owns the hierarchy (Store > Category >
// Product) and passes it in, because a flat `product/:id` route can't express
// those ancestors lexically for the matcher to derive.
export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {trail.map((crumb, i) => {
        const last = i === trail.length - 1;

        return (
          <span key={i} className="crumb">
            {crumb.to && !last ? (
              <Link to={crumb.to}>{crumb.label}</Link>
            ) : (
              <span aria-current={last ? 'page' : undefined}>
                {crumb.label}
              </span>
            )}
            {!last && (
              <span className="sep" aria-hidden="true">
                ›
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
