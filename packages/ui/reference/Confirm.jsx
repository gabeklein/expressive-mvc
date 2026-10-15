import { Button } from 'common/button/Button';
import { Modal } from 'common/modal/Modal';

import { Flex } from './Flex';

/**
 * @param {Object} props - The properties for the confirmation modal.
 * @param {() => Async<void>} [props.close] - Function to call when closing the modal.
 * @param {() => boolean | void | Promise<boolean | void>} [props.confirm] - Function to call when confirming the action.
 * @param {string} [props.title] - The title of the confirmation modal.
 * @param {React.ReactNode} [props.children] - The content to display inside the modal.
 * @param {() => Async<void>} [props.cancel] - Function to call when cancelling the action.
 * @param {boolean} [props.disabled] - If true, the confirm button will be disabled.
 */
export const Confirm = ({
  close,
  cancel,
  confirm,
  title,
  children,
  disabled
}) => {
  width: 400;
  height: auto;
  textAlign: center;
  fontFamily: 'Inter';

  Flex: {
    marginTop: 2.5;

    Button: {
      flex: 1;

      confirm: {
        background: $primaryRed;
        color: white;
        fontWeight: 500;
        border: none;
      }
    }
  }

  const onCancel = async () => {
    if (cancel) await cancel();
    if (close) close();
  };

  return (
    <Modal onClose={onCancel}>
      {title && <h3>{title}</h3>}
      {children}
      <Flex>
        <Button secondary onClick={onCancel}>
          Cancel
        </Button>
        <Button
          _confirm
          disabled={disabled}
          onClick={async () => {
            const x = confirm && (await confirm());
            if (x !== false && close) close();
          }}>
          Confirm
        </Button>
      </Flex>
    </Modal>
  );
};
