import { Component, ref, set } from "@expressive/react";

interface CanvasProps {
  style?: React.CSSProperties;
  className?: string;
}

export abstract class Canvas2D extends Component {
  element = ref<HTMLCanvasElement>((element) => {
    this.context2d = element.getContext('2d')!;
    const removed = this.ready();
    this.active = true;

    return removed;
  });

  context2d = set<CanvasRenderingContext2D>();

  /**
   * Starts the animation loop when true, and stops it when false.
   * Use this to pause the animation when the component is not visible.
   */
  active = set(false, (isActive) => {
    return isActive && this.start();
  });

  /**
   * Called when CanvasRenderingContext2D is ready.
   * If a function is returned, it will be called when the component unmounts.
  */
  protected abstract ready(): void | (() => void);

  /** Called on every animation frame. */
  protected abstract draw(): void;

  /** Starts the animation loop. Return a function to stop the loop when called. */
  protected start(){
    let active = true;

    const loop = () => {
      if (!active) return;
      this.draw();
      requestAnimationFrame(loop);
    };

    loop();

    const stop = () => active = false;

    this.get(null, stop);

    return stop;
  }

  render(props = {} as CanvasProps) {
    return <canvas {...props} ref={this.element} />;
  }
}