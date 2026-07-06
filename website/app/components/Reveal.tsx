import type React from 'react';
import State, { ref } from '@expressive/react';

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

class Visibility extends State {
  shown = false;

  element = ref<HTMLDivElement>((el) => {
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          this.shown = true;
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );

    io.observe(el);
    return () => io.disconnect();
  });
}

export default function Reveal({ children, className, delay, from = 'up' }: RevealProps) {
  const { shown, element } = Visibility.use();

  return (
    <div
      ref={element}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-x-0 motion-reduce:translate-y-0 ${
        shown ? 'opacity-100 translate-x-0 translate-y-0' : `opacity-0 ${OFFSET[from]}`
      } ${className || ''}`}>
      {children}
    </div>
  );
}
