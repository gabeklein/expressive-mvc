import type React from 'react';
import { useEffect, useRef, useState } from 'react';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  from?: 'up' | 'left' | 'right';
}

const OFFSET = {
  up: 'translate-y-6',
  left: '-translate-x-8',
  right: 'translate-x-8',
};

export default function Reveal({ children, className, delay, from = 'up' }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-x-0 motion-reduce:translate-y-0 ${
        shown ? 'opacity-100 translate-x-0 translate-y-0' : `opacity-0 ${OFFSET[from]}`
      } ${className || ''}`}>
      {children}
    </div>
  );
}
