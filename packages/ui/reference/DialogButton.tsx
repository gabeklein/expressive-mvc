import { Model } from '@expressive/react';
import { SquarePen } from 'lucide-react';
import { cloneElement, isValidElement } from 'react';

import { Dialog } from 'common/Dialog';

import { Button } from './Button';
import { IconButton } from './IconButton';

interface DialogButtonProps {
  icon?: React.FC<React.SVGProps<SVGSVGElement>>;
  label?: string;
  title?: string;
  children: React.ReactElement;
  disabled?: boolean;
}

export class DialogButton extends Model {
  content = false;

  close() {
    this.content = false;
  }

  render(props: DialogButtonProps) {
    const { children, label, icon, title, ...rest } = props;
    const { content, close } = this;

    const click = () => {
      this.content = true;
    };

    return (
      <>
        {label ? (
          <Button {...rest} onClick={click}>
            {label}
          </Button>
        ) : (
          <IconButton icon={icon || SquarePen} {...rest} onClick={click} />
        )}
        {content && (
          <Dialog close={close} title={title || label}>
            {isValidElement<{ close?: () => void }>(children)
              ? cloneElement(children, { close })
              : null}
          </Dialog>
        )}
      </>
    );
  }
}
