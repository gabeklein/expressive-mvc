import { Component, ref, set } from '@expressive/react';
import { Canvas2D } from './Canvas';

export function Background(){
  position: fixed;
  height: `100vh`;
  width: `100vw`;
  zIndex: -1;

  AnimateBG: {
    position: absolute;
    filter: `blur(3px)`;
    top: 0;
    left: 0;
  }

  return (
    <div>
      <AnimateBG />
    </div>
  )
}

interface Particle {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  life: number;
}

export class AnimateBG extends Canvas2D {
  width = 0;
  height = 0;
  speed = 0.1;

  particleColor = '';
  particleRadius = 3;
  particleCount = 100;
  particleLife = 20;
  maxLineLength = 150;
  minLineLength = 140;

  protected particles = new Set<Particle>();

  protected ready() {
    const context = this.context2d;
    const canvas = context.canvas;
    const parent = canvas.parentElement!;
    const dpr = window.devicePixelRatio || 1;

    context.scale(dpr, dpr);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    this.particleColor =
      getComputedStyle(parent).getPropertyValue('--accent') || '#bbb';

    const onResize = () => {
      const rect = parent.getBoundingClientRect();
      canvas.width = this.width = rect.width;
      canvas.height = this.height = rect.height;
    };

    window.addEventListener('resize', onResize);
    onResize();

    for (let i = 0; i < this.particleCount; i++) this.spawn();
  
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }

  protected draw() {
    const { context2d: canvas, particles } = this;

    canvas.clearRect(0, 0, this.width, this.height);

    for (const particle of particles) this.update(particle);

    for (const p1 of particles)
      for (const p2 of particles) this.drawLine(p1, p2);
  }

  protected spawn() {
    const { speed, particleLife } = this;

    this.particles.add({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      velocityX: Math.random() * speed * 2 - speed,
      velocityY: Math.random() * speed * 2 - speed,
      life: Math.random() * particleLife * 60
    });
  }

  protected update(particle: Particle) {
    const { particleColor, particleRadius, context2d: canvas, width, height } = this;

    const { x: positionX, y: positionY, velocityX, velocityY } = particle;

    if (particle.life < 1) {
      this.particles.delete(particle);
      this.spawn();
      return;
    }

    if (
      (velocityX > 0 && positionX + velocityX > width) ||
      (velocityX < 0 && positionX + velocityX < 0)
    ) {
      particle.velocityX *= -1;
    }

    if (
      (velocityY > 0 && positionY + velocityY > height) ||
      (velocityY < 0 && positionY + velocityY < 0)
    ) {
      particle.velocityY *= -1;
    }

    particle.life--;
    particle.x += particle.velocityX;
    particle.y += particle.velocityY;

    canvas.beginPath();
    canvas.arc(particle.x, particle.y, particleRadius, 0, Math.PI * 2);
    canvas.closePath();
    canvas.fillStyle = particleColor;
    canvas.fill();
  }

  protected drawLine(p1: Particle, p2: Particle) {
    const { context2d: canvas } = this;
    const { x: x1, y: y1 } = p1;
    const { x: x2, y: y2 } = p2;

    const fadeMarginPx = 10;
    const fadeTimeMs = 500;

    length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

    if (length >= this.maxLineLength || length < this.minLineLength) return;

    // distance from min/max length
    const lengthOpacity = Math.min(
      1,
      Math.min(this.maxLineLength - length, length - this.minLineLength) /
        fadeMarginPx
    );

    // distance from life == 0 of either point
    const timeOpacity = Math.min(1, Math.min(p1.life, p2.life) / fadeTimeMs);

    // final opacity is the minimum of the two
    const opacity = Math.min(lengthOpacity, timeOpacity);
    const opacityBase16 = Math.floor(opacity * 255).toString(16);

    canvas.lineWidth = 0.5;
    canvas.strokeStyle = this.particleColor + opacityBase16;

    canvas.beginPath();
    canvas.moveTo(x1, y1);
    canvas.lineTo(x2, y2);
    canvas.closePath();
    canvas.stroke();
  }
}
