import State, { Component, ref } from '@expressive/mvc';

let OPEN = 0;

/**
 * Dismissible layer: escape-to-close, backdrop-click-to-close, and a shared
 * count of how many are open (for scroll-lock / blur on the document body).
 *
 * DOM-coupled by necessity - `escape` binds the document and `backdrop` binds an
 * element. Portalling is deliberately NOT here; a host subclass owns that, since
 * there is no agnostic portal seam. This is the piece Dialog, Popover, Tooltip
 * and Menu all want.
 */
abstract class Overlay extends Component {
  /** Called when the layer asks to close. Absent means non-dismissible. */
  onClose?: () => void = undefined;

  /** Close on Escape. */
  escapeKey = true;

  /** Close when the backdrop itself is pressed. */
  backdropClose = true;

  /** Number of Overlays currently mounted, across the whole document. */
  static get open() {
    return OPEN;
  }

  constructor(...args: State.Args) {
    super(...args, () => {
      OPEN++;

      if (this.escapeKey) {
        const escape = (event: KeyboardEvent) => {
          if (event.key === 'Escape') this.close();
        };

        document.addEventListener('keydown', escape);
        this.get(null, () => document.removeEventListener('keydown', escape));
      }

      return () => void OPEN--;
    });
  }

  /**
   * Binds the backdrop element. Dismissal requires both mousedown AND click to
   * land on the backdrop itself, so a drag that merely *ends* on the backdrop
   * does not close the layer.
   */
  backdrop = ref<HTMLElement>((element) => {
    let armed = false;

    const down = (event: MouseEvent) => {
      armed = event.target === element;
    };

    const up = (event: MouseEvent) => {
      if (armed && event.target === element && this.backdropClose) this.close();
      armed = false;
    };

    element.addEventListener('mousedown', down);
    element.addEventListener('click', up);

    return () => {
      element.removeEventListener('mousedown', down);
      element.removeEventListener('click', up);
    };
  });

  close() {
    if (this.onClose) this.onClose();
  }
}

export { Overlay };
