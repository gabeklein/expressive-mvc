import './Button.css';

import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accent-colored call-to-action variant. */
  primary?: boolean;
}

/** Generic chrome only - anything pedagogically interesting belongs in the example. */
export default ({ primary, className, ...rest }: ButtonProps) => (
  <button
    {...rest}
    className={['button', primary && 'primary', className].filter(Boolean).join(' ')}
  />
);
