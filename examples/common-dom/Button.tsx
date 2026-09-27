/** @jsxImportSource @expressive/dom */
import './Button.css';

import type { JSX } from '@expressive/dom/jsx-runtime';

type ButtonProps = JSX.IntrinsicElements['button'] & {
  primary?: boolean;
};

export default ({ primary, class: className, ...rest }: ButtonProps) => (
  <button
    {...rest}
    class={['button', primary && 'primary', className].filter(Boolean).join(' ')}
  />
);
