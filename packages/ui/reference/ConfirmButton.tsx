import { useState } from 'react';

import { Confirm } from 'common/Confirm';
import { Button } from 'common/button/Button';

import { IconButton } from './IconButton';

interface ConfirmButtonProps {
  confirm: () => Promise<void>;
  disabled?: boolean;
  title?: string;
  label: string;
  icon?: React.FC;
  children: React.ReactNode;
}

export const ConfirmButton = (props: ConfirmButtonProps) => {
  const { confirm, label, title, children, icon, disabled } = props;
  const [active, setActive] = useState(false);

  return (
    <>
      {icon ? (
        <IconButton
          disabled={disabled}
          icon={icon}
          onClick={() => setActive(true)}
          aria-label={label}
        />
      ) : (
        <Button onClick={() => setActive(true)} disabled={disabled}>
          {label}
        </Button>
      )}
      {active && (
        <Confirm
          title={title || label}
          confirm={async () => {
            await confirm();
            setActive(false);
          }}
          close={() => setActive(false)}>
          {children}
        </Confirm>
      )}
    </>
  );
};
