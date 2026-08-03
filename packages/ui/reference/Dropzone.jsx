import { Download } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

/**
 * @param {import("react-dropzone").DropzoneOptions & { className?: string, warning?: unknown }} props
 */
export const Dropzone = ({ className, warning, ...props }) => {
  const { getInputProps, getRootProps, isDragActive } = useDropzone(props);

  dropzone: {
    border: 0xd0d5dd;
    borderRadius: 8;
    padding: 25, 20, 15;
    textAlign: center;
    cursor: pointer;
    backgroundColor: white;
    color: 0x6b7280;

    if (isDragActive) {
      backgroundColor: 0xf3f4f6;
      color: 0x111827;
      borderColor: $blue;
    }

    if (warning) {
      borderColor: 0xfcc0c0;
      color: 0xf85d5dcf;
    }
  }

  DownloadIcon: {
    padding: 10;
    border: 0xddd;
    radius: 8;
    shadow: 0x1;
  }

  p: {
    fontSize: 0.9;
  }

  return (
    <div _dropzone {...getRootProps()} className={className}>
      <input type="file" {...getInputProps()} multiple />
      <Download />
      {typeof warning == 'string' ? (
        <p>{warning}</p>
      ) : (
        <p>Click to upload or drag and drop</p>
      )}
    </div>
  );
};
