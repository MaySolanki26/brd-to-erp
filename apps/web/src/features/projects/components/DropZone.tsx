import { useId, useRef, useState } from 'react';
import { Lock, UploadCloud } from 'lucide-react';
import { MAX_UPLOAD_BYTES, SOURCE_FILE_ACCEPT } from '@brd/shared';

interface DropZoneProps {
  /** People without permission to add sources see a read-only hint instead. */
  canAddSource: boolean;
  onFiles: (files: File[]) => void;
}

const LIMIT_MB = MAX_UPLOAD_BYTES / 1024 / 1024;

export function DropZone({ canAddSource, onFiles }: DropZoneProps) {
  const hintId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  if (!canAddSource) {
    return (
      <div role="note" className="uab-dropzone uab-is-readonly">
        <Lock size={16} aria-hidden />
        You can view sources but not add them.
      </div>
    );
  }

  const open = () => input.current?.click();

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const dropped = Array.from(event.dataTransfer.files);
    if (dropped.length > 0) onFiles(dropped);
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload documents"
        aria-describedby={hintId}
        data-dragging={dragging}
        className={`uab-dropzone${dragging ? ' uab-is-dragging' : ''}`}
        onClick={open}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            open();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <UploadCloud size={24} aria-hidden />
        <p className="uab-dropzone-title">
          Drop files here or <span className="uab-dropzone-link">browse</span>
        </p>
        <p id={hintId} className="uab-muted">
          PDF, DOCX or XLSX, up to {LIMIT_MB} MB each
        </p>
      </div>
      <input
        ref={input}
        type="file"
        multiple
        accept={SOURCE_FILE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose files to upload"
        onChange={(event) => {
          const chosen = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (chosen.length > 0) onFiles(chosen);
        }}
      />
    </>
  );
}
