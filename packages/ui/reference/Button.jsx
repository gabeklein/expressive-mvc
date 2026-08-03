import { useState } from 'react';

/**
 * Styled button component for use in the application.
 *
 * @param {Object} props - The component props.
 * @param {boolean} [props.secondary] - If true, the button will have a secondary style.
 * @param {string} [props.text] - The text to display inside the button.
 * @param {string} [props.className] - Additional class names for styling.
 * @param {React.ReactNode} [props.children] - The children to display inside the button.
 * @param {(event: React.MouseEvent<any, MouseEvent>) => any} [props.onClick] - The click handler for the button.
 * @param {boolean} [props.disabled] - If true, the button will be disabled.
 */
export const Button = ({
  secondary = false,
  text = '',
  children = null,
  disabled = false,
  onClick
}) => {
  const [pending, setPending] = useState(false);

  background: $accent;
  border: $accent;
  display: flex;
  alignItems: center;
  justifyContent: center;
  textAlign: center;
  padding: 0.7, 1.4;
  userSelect: none;
  WebkitUserSelect: none;
  radius: 8;
  transition: 'all 0.1s ease-in-out';
  cursor: pointer;
  border: none;
  fontWeight: 400;
  color: white;
  whiteSpace: 'nowrap';

  if (':active') {
    transform: 'scale(0.98)';
  }

  if (disabled) {
    transform: 'scale(1) !important';
    filter: 'brightness(80%)';
    opacity: 0.4;
    cursor: 'not-allowed';
  }

  if (secondary) {
    color: $accent;
    background: $secondary;
    border: $border;
  }

  return (
    <button
      disabled={!onClick || disabled}
      onClick={
        onClick &&
        ((event) => {
          if (pending) return;

          const result = onClick(event);

          if (result instanceof Promise) {
            setPending(true);
            result.finally(() => setPending(false));
          }
        })
      }>
      {children || text}
    </button>
  );
};
