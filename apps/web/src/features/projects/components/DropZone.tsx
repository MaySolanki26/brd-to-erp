import { useId, useRef, useState } from 'react';
import { Lock, UploadCloud } from 'lucide-react';
import { MAX_UPLOAD_BYTES, SOURCE_FILE_ACCEPT } from '@brd/shared';
import { cn } from '@brd/ui';

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
      <div
        role="note"
        className="flex items-center gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground"
      >
        <Lock className="h-4 w-4" aria-hidden />
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
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          dragging ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40',
        )}
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
        <UploadCloud className="h-6 w-6 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">
          Drop files here or <span className="text-primary underline">browse</span>
        </p>
        <p id={hintId} className="text-xs text-muted-foreground">
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
