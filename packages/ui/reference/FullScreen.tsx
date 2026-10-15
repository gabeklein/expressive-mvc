import { Model, ref, set } from '@expressive/react';
import ReactDOM from 'react-dom';

let MODALS_OPEN = 0;

class FullScreen extends Model {
  onClose?: () => void = undefined;

  root: HTMLDivElement | string = 'react-root';
  modalRoot = set<HTMLDivElement>();

  constructor(...args: Model.Args) {
    super(args, () => this.new());
  }

  private new() {
    document.addEventListener('keydown', this.handleEscape);

    let { root } = this;

    if (typeof root === 'string')
      root = document.getElementById(root) as HTMLDivElement;

    document.body.classList.add('full-screen-blur');
    MODALS_OPEN++;

    const parent =
      (root instanceof HTMLDivElement && root.parentElement) || document.body;

    this.modalRoot = parent.appendChild(document.createElement('div'));

    return () => {
      parent.removeChild(this.modalRoot);
      document.removeEventListener('keydown', this.handleEscape);

      if (--MODALS_OPEN == 0)
        document.body.classList.remove('full-screen-blur');
    };
  }

  dialog = ref<HTMLDivElement>((dialog) => {
    const child = dialog.firstElementChild as HTMLDivElement;

    child.tabIndex = -1;
    child.role = 'dialog';
    child.ariaModal = 'true';

    let mouseDownOnDialog = false;

    const onMouseDown = (event: MouseEvent) => {
      mouseDownOnDialog = event.target === dialog;
    };

    const onClick = (event: MouseEvent) => {
      if (event.target === dialog && mouseDownOnDialog) this.close();
    };

    dialog.addEventListener('mousedown', onMouseDown);
    dialog.addEventListener('click', onClick);

    return () => {
      dialog.removeEventListener('mousedown', onMouseDown);
      dialog.removeEventListener('click', onClick);
    };
  });

  public render(props: { children: React.ReactNode; className?: string }) {
    const { dialog, modalRoot } = this;

    return ReactDOM.createPortal(<div {...props} ref={dialog} />, modalRoot);
  }

  protected close() {
    if (this.onClose) this.onClose();
  }

  protected handleEscape(e: KeyboardEvent) {
    if (e.key === 'Escape') this.close();
  }
}

export { FullScreen };
