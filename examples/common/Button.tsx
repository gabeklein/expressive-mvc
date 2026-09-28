import './Button.css';

import type { JSX } from '@expressive/mvc/jsx-runtime';

type ButtonProps = JSX.IntrinsicElements['button'] & {
  primary?: boolean;
};

export default ({ primary, className, ...rest }: ButtonProps) => (
  <button
    {...rest}
    className={['button', primary && 'primary', className].filter(Boolean).join(' ')}
  />
);
