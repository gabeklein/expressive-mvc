import './Button.css';

import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  primary?: boolean;
}

export default ({ primary, className, ...rest }: ButtonProps) => (
  <button
    {...rest}
    className={['button', primary && 'primary', className].filter(Boolean).join(' ')}
  />
);
