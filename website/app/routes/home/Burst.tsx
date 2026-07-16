import { Component, ref } from '@expressive/react';
import type React from 'react';
import './Burst.css';

export class RainbowText extends Component {
  duration: number | string = 2000;
  rootMargin = '0px 0px -40% 0px';
  threshold: number | number[] = 0.75;

  element = ref<HTMLSpanElement>((el) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.classList.add('rainbow-burst-active');
        observer.disconnect();
      },
      { rootMargin: this.rootMargin, threshold: this.threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  });

  render({ children } = {} as { children?: React.ReactNode; }) {
    const animationDuration = typeof this.duration === 'number'
      ? `${this.duration}ms`
      : this.duration;

    return (
      <span ref={this.element} className="relative inline-block">
        {children}
        <span
          aria-hidden
          className="rainbow-burst-overlay absolute inset-0"
          style={{ animationDuration }}>
          {children}
        </span>
      </span>
    );
  }
}
