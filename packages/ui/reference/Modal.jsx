import { FullScreen } from './FullScreen';

export const Modal = FullScreen.as(
  /**
   * @param {Object} props
   * @param {string} [props.className] - Additional class name for styling.
   * @param {React.ReactNode} [props.children] - The content to display inside the modal.
   */
  ({ className, children }) => {
    FullScreen: {
      position: fixed;
      top: 0;
      left: 0;
      width: '100vw';
      height: '100vh';
      background: 0xfff3;
      display: flex;
      justifyContent: center;
      alignItems: center;
      zIndex: 1000;
    }

    inner: {
      padding: 30, 50, 50;
      maxHeight: 'calc(100vh - 150px)';
      animation: 'fadeInUp 0.3s ease-out forwards';
      background: white;
      shadow: 0xccc;
      borderRadius: 10;
      position: relative;
      overflow: hidden;
      overflowY: auto;
    }

    return (
      <div _inner className={className}>
        {children}
      </div>
    );
  }
);
