import { AlertTriangle, X as CloseIcon } from 'lucide-react';
import { createContext, useContext, useState } from 'react';

import { Button } from 'common/button/Button';
import { Modal } from 'common/modal/Modal';
import { Hold } from 'common/spinner/Spinner';

const DialogContext = createContext(() => {});

/**
 * A provider for the dialog close function.
 * @type {React.FC<{
 *  close: () => void
 *  children?: React.ReactNode
 * }>}
 */
export const DialogProvider = ({ children, close }) => (
  <DialogContext.Provider value={close} children={children} />
);

export const useDialog = () => useContext(DialogContext);

/**
 * @type {React.FC<{
 *  title?: string
 *  close?: () => void
 *  fillHeight?: boolean
 *  confirm?: () => Async<void | boolean>
 *  confirmButton?: string
 *  className?: string
 *  children?: React.ReactNode
 * }>}
 */
export const Dialog = ({
  title,
  children,
  fillHeight,
  className,
  close,
  confirm,
  ...props
}) => {
  if (!close) close = useContext(DialogContext);

  display: flex;
  flexDirection: column;
  padding: 0;
  margin: 20;
  radius: 10;
  overflow: hidden;
  maxHeight: '90vh';
  position: relative;

  if (fillHeight) {
    height: fill;
  }

  container: {
    animation: 'fadeInUp 0.3s ease-out forwards';
    background: inherit;
    overflowY: auto;
    width: 450;
  }

  header: {
    position: sticky;
    top: 0;
    background: inherit;
    zIndex: 1000;
    padding: 30;
    display: flex;
    justifyContent: spaceBetween;

    CloseIcon: {
      marginLeft: 'auto';
      fontSize: 1.3;
      cursor: pointer;
      zIndex: 1001;
    }
  }

  body: {
    padding: 0, 30, 30;
    gap: 20;
    display: flex;
    flexDirection: column;
    flex: 1;
  }

  return (
    <Modal onClose={close}>
      <div _container className={className}>
        <Row _header>
          <strong>{title}</strong>
          <CloseIcon onClick={close} />
        </Row>
        {confirm ? (
          <Prompt {...props} close={close} confirm={confirm}>
            <div _body>{children}</div>
          </Prompt>
        ) : (
          <div _body>{children}</div>
        )}
      </div>
    </Modal>
  );
};

/**
 * @type {React.FC<{
 *  confirm: () => Async<boolean | void>
 *  className?: string
 *  confirmButton?: React.ReactNode
 *  close: () => void
 *  closeButton?: React.ReactNode
 *  children?: React.ReactNode
 * }>}
 */
const Prompt = ({ confirm, close, children, confirmButton, closeButton }) => {
  /** @type {[any, any]} */
  const [waiting, setWaiting] = useState(false);
  /** @type {[any, any]} */
  const [error, setError] = useState(null);

  Hold: {
    background: 0xfffa;
    zIndex: 100;
  }

  buttons: {
    position: sticky;
    bottom: 0;
    display: flex;
    justifyContent: flexEnd;
    gap: 10;
    fontSize: 0.9;
    borderTop: 0xe3e3e3, 1;
    padding: '20px';
    background: inherit;
    zIndex: 100;

    Button: {
      padding: 10, 15;
    }
  }

  return (
    <>
      {error instanceof Error ? (
        <Oops error={error} dismiss={() => setError(null)} />
      ) : waiting ? (
        <Hold />
      ) : null}
      {children}
      <Row _buttons>
        <Button secondary onClick={close}>
          {closeButton || 'Cancel'}
        </Button>
        <Button
          onClick={async () => {
            if (waiting) return;

            try {
              setWaiting(true);
              const result = await confirm();
              if (result !== false && close) close();
            } catch (e) {
              console.error(e);
              setError(e);
            } finally {
              setWaiting(false);
            }
          }}>
          {confirmButton || 'Save'}
        </Button>
      </Row>
    </>
  );
};

/**
 * @type {React.FC<{
 *  error: Error
 *  dismiss?: () => void
 * }>}
 */
export const Oops = ({ error, dismiss }) => {
  flexAlign: center, down;
  $spinColor: 'currentColor';
  color: $textGrey;
  absolute: fill;
  background: 0xfffd;
  flex: 1;
  zIndex: 1000;

  inner: {
    animation: 'fadeInUp 0.3s ease-out forwards';
    flexAlign: center, down;
    padding: 20, 50;
  }

  h2: {
    display: flex;
    gap: 0.3;
    alignItems: center;
    marginBottom: 10;
    color: 0xf44336;

    WarningIcon: {
      fontSize: 1.2;
    }
  }

  p: {
    margin: 20, auto;
    textAlign: center;
  }

  return (
    <div>
      <div _inner>
        <h2>
          <AlertTriangle />
          Error
        </h2>
        <p>{error.message}</p>
      </div>
      <Button onClick={dismiss} secondary>
        Ok
      </Button>
    </div>
  );
};

/** @type {React.FC<React.PropsWithChildren>} */
export const Row = (props) => {
  display: flex;
  alignItems: flexEnd;
  justifyContent: stretch;
  flexWrap: wrap;
  gap: 10;

  return <div {...props} />;
};
