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
    const show = () => {
      if (this.shown) return;
      this.shown = true;
      io.disconnect();
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) show();
      },
      { threshold: 0, rootMargin: '0px 0px -8% 0px' },
    );

    io.observe(el);

    const frames: number[] = [];
    frames.push(requestAnimationFrame(() => {
      frames.push(requestAnimationFrame(() => {
        if (this.shown) return;
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight;
        const vw = window.innerWidth;
        if (rect.bottom > 0 && rect.top < vh * 0.92 && rect.right > 0 && rect.left < vw)
          show();
      }));
    }));

    return () => {
      io.disconnect();
      for (const id of frames) cancelAnimationFrame(id);
    };
  });
}

export default function Reveal({ children, className, delay, from = 'up' }: RevealProps) {
  const { shown, element } = Visibility.use();

  return (
    <div
      ref={element}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-x-0 motion-reduce:translate-y-0 ${
        shown ? 'opacity-100 translate-x-0 translate-y-0' : `opacity-0 ${OFFSET[from]}`
      } ${className || ''}`}>
      {children}
    </div>
  );
}
