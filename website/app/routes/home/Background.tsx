import { Canvas2D } from '@/components/Canvas';

export function Background() {
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
  );
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

  particles = new Set<Particle>();

  protected ready() {
    const context = this.canvas;
    const element = context.canvas;
    const parent = element.parentElement!;
    const dpr = window.devicePixelRatio || 1;

    context.scale(dpr, dpr);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    this.particleColor =
      getComputedStyle(parent).getPropertyValue('--accent') || '#bbb';

    const onResize = () => {
      const rect = parent.getBoundingClientRect();
      element.width = this.width = rect.width;
      element.height = this.height = rect.height;
    };

    window.addEventListener('resize', onResize);
    onResize();

    for (let i = 0; i < this.particleCount; i++) new Particle(this);

    return () => {
      window.removeEventListener('resize', onResize);
    };
  }

  protected draw() {
    const { canvas, particles } = this;

    canvas.clearRect(0, 0, this.width, this.height);

    for (const particle of particles)
      if (particle.life > 0) {
        particle.update();
        particle.draw();
      } else {
        this.particles.delete(particle);
        new Particle(this);
      }

    for (const p1 of particles) for (const p2 of particles) p1.drawLine(p2);
  }
}

class Particle {
  x: number;
  y: number;
  direction: number;
  speed: number;
  life: number;

  constructor(private parent: AnimateBG) {
    parent.particles.add(this);
    this.x = Math.random() * parent.width;
    this.y = Math.random() * parent.height;
    this.speed = parent.speed;
    this.life = Math.random() * parent.particleLife * 60;
    this.direction = Math.random() * Math.PI * 2;
  }

  update() {
    const { width, height } = this.parent;

    this.x += Math.cos(this.direction) * this.speed;
    this.y += Math.sin(this.direction) * this.speed;

    if (this.x < 0 || this.x > width) this.direction = Math.PI - this.direction;
    if (this.y < 0 || this.y > height) this.direction = -this.direction;

    this.life--;
  }

  draw() {
    const { canvas, particleColor, particleRadius } = this.parent;

    canvas.beginPath();
    canvas.arc(this.x, this.y, particleRadius, 0, Math.PI * 2);
    canvas.closePath();
    canvas.fillStyle = particleColor;
    canvas.fill();
  }

  drawLine(to: Particle) {
    const {
      canvas,
      particleColor,
      maxLineLength,
      minLineLength
    } = this.parent;

    const length = Math.sqrt((to.x - this.x) ** 2 + (to.y - this.y) ** 2);

    if (length >= maxLineLength || length < minLineLength) return;

    const fadeMarginPx = 10;
    const fadeTimeMs = 500;

    const lengthOpacity = Math.min(
      1,
      Math.min(maxLineLength - length, length - minLineLength) / fadeMarginPx
    );

    const timeOpacity = Math.min(1, Math.min(this.life, to.life) / fadeTimeMs);
    const opacity = Math.min(lengthOpacity, timeOpacity);
    const opacityBase16 = Math.floor(opacity * 255).toString(16);

    canvas.lineWidth = 0.5;
    canvas.strokeStyle = particleColor + opacityBase16;
    canvas.beginPath();
    canvas.moveTo(this.x, this.y);
    canvas.lineTo(to.x, to.y);
    canvas.closePath();
    canvas.stroke();
  }
}
