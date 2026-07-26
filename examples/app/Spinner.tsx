import styles from './Spinner.module.css';

// Tail-spin loader: a stroke with a transparent-to-solid gradient, rotated.
// Colored via `currentColor`, sized via `font-size` on the parent.
export function Spinner() {
  return (
    <svg
      className={styles.rotating}
      viewBox="-2 -2 42 42"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true">
      <defs>
        <linearGradient
          id="spinner-gradient"
          x1="8.042%"
          y1="0%"
          x2="65.682%"
          y2="23.865%">
          <stop stopColor="currentColor" stopOpacity="0" offset="0%" />
          <stop stopColor="currentColor" stopOpacity=".631" offset="63.146%" />
          <stop stopColor="currentColor" offset="100%" />
        </linearGradient>
      </defs>
      <g fill="none" fillRule="evenodd">
        <g transform="translate(1 1)">
          <path
            d="M36 18c0-9.94-8.06-18-18-18"
            stroke="url(#spinner-gradient)"
            strokeWidth="2"
          />
          <circle fill="currentColor" cx="36" cy="18" r="1" />
        </g>
      </g>
    </svg>
  );
}
