import { Canvas2D } from '@/components/Canvas';

const PARTICLE_DENSITY = 100 / (1440 * 900);
const MOBILE_MAX_WIDTH = 640;
const MOBILE_PARTICLE_OPACITY = 0.4;
const MOBILE_LINE_OPACITY = 0.25;

export function Background() {
  return (
    <div className="fixed h-screen w-screen -z-1">
      <AnimateBG className="absolute top-0 left-0 blur-xs" />
    </div>
  );
}

export class AnimateBG extends Canvas2D {
  width = 0;
  height = 0;
  speed = 0.1;

  particleColor = '';
  particleOpacity = 1;
  particleRadius = 3;
  particleCount = 100;
  particleLife = 20;
  lineOpacity = 1;
  maxLineLength = 150;
  minLineLength = 140;

  // Wind down after ~5m so an idle tab stops burning frames.
  decayAfter = 5 * 60 * 60;
  frames = 0;
  damper = 1;
  stopped = false;

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
      const mobile = this.width <= MOBILE_MAX_WIDTH;
      this.particleOpacity = mobile ? MOBILE_PARTICLE_OPACITY : 1;
      this.lineOpacity = mobile ? MOBILE_LINE_OPACITY : 1;
      this.particleCount = Math.min(
        100,
        Math.max(16, Math.round(this.width * this.height * PARTICLE_DENSITY)),
      );
      this.syncParticleCount();
      if (this.stopped) this.paint(false);
    };

    const onVisibility = () => {
      this.active = !this.stopped && !document.hidden && document.hasFocus();
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('blur', onVisibility);
    window.addEventListener('focus', onVisibility);
    document.addEventListener('visibilitychange', onVisibility);
    onResize();

    // ready() may re-run on the same instance (remount, strict-mode) -
    // reset rather than pile new particles onto the old set.
    this.particles.clear();
    this.frames = 0;
    this.damper = 1;
    this.stopped = false;

    for (let i = 0; i < this.particleCount; i++) new Particle(this);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('blur', onVisibility);
      window.removeEventListener('focus', onVisibility);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }

  protected draw() {
    this.frames++;

    if (this.frames > this.decayAfter) this.damper *= 0.995;

    this.paint(true);

    if (this.damper < 0.02) {
      this.stopped = true;
      this.active = false;
    }
  }

  private paint(update: boolean) {
    const { canvas, particles } = this;
    canvas.clearRect(0, 0, this.width, this.height);

    for (const particle of particles)
      if (particle.life > 0) {
        if (update) particle.update();
        particle.draw();
      } else {
        this.particles.delete(particle);
        new Particle(this);
      }

    for (const p1 of particles) for (const p2 of particles) p1.drawLine(p2);
  }

  private syncParticleCount() {
    while (this.particles.size > this.particleCount) {
      const particle = this.particles.values().next().value;
      if (!particle) break;
      this.particles.delete(particle);
    }

    while (this.particles.size < this.particleCount) new Particle(this);
  }
}

function alphaHex(opacity: number) {
  return Math.round(opacity * 255).toString(16).padStart(2, '0');
}

function colorWithAlpha(color: string, opacity: number) {
  return opacity >= 1 ? color : color + alphaHex(opacity);
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
    const { width, height, damper } = this.parent;

    this.x += Math.cos(this.direction) * this.speed * damper;
    this.y += Math.sin(this.direction) * this.speed * damper;

    if (this.x < 0 || this.x > width) this.direction = Math.PI - this.direction;
    if (this.y < 0 || this.y > height) this.direction = -this.direction;

    this.life -= damper;
  }

  draw() {
    const { canvas, particleColor, particleOpacity, particleRadius } = this.parent;

    canvas.beginPath();
    canvas.arc(this.x, this.y, particleRadius, 0, Math.PI * 2);
    canvas.closePath();
    canvas.fillStyle = colorWithAlpha(particleColor, particleOpacity);
    canvas.fill();
  }

  drawLine(to: Particle) {
    const { canvas, lineOpacity, particleColor, maxLineLength, minLineLength } = this.parent;

    const length = Math.sqrt((to.x - this.x) ** 2 + (to.y - this.y) ** 2);

    if (length >= maxLineLength || length < minLineLength) return;

    const fadeMarginPx = 10;
    const fadeTimeMs = 500;

    const lengthOpacity = Math.min(
      1,
      Math.min(maxLineLength - length, length - minLineLength) / fadeMarginPx,
    );

    const timeOpacity = Math.min(1, Math.min(this.life, to.life) / fadeTimeMs);
    const opacity = Math.min(lengthOpacity, timeOpacity) * lineOpacity;

    canvas.lineWidth = 0.5;
    canvas.strokeStyle = colorWithAlpha(particleColor, opacity);
    canvas.beginPath();
    canvas.moveTo(this.x, this.y);
    canvas.lineTo(to.x, to.y);
    canvas.closePath();
    canvas.stroke();
  }
}
