'use client';

import { CloudUpload, FileSpreadsheet, X } from 'lucide-react';
import { useId, useRef, useState, type DragEvent } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MAX_IMPORT_BYTES } from '@/shared';

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Why a file cannot be used, or null. The API checks the content again. */
function fileProblem(file: File, maxBytes: number): string | null {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return 'Choose an Excel workbook (.xlsx). Save other formats as .xlsx first.';
  }
  if (file.size > maxBytes) return `This file is larger than ${maxBytes / 1024 / 1024} MB.`;
  return null;
}

/**
 * A drop zone for one .xlsx workbook, with a browse button. Once chosen, the file is shown with
 * its size and can be changed or removed.
 */
export function FileDrop({
  file,
  onChange,
  disabled,
  maxBytes = MAX_IMPORT_BYTES,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  /** The largest file accepted. */
  maxBytes?: number;
}) {
  const inputId = useId();
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  function take(chosen: File | undefined) {
    if (!chosen) return;
    const reason = fileProblem(chosen, maxBytes);
    setProblem(reason);
    if (!reason) onChange(chosen);
    // Let the same file be chosen again after it was removed.
    if (inputRef.current) inputRef.current.value = '';
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (!disabled) take(event.dataTransfer.files[0]);
  }

  const input = (
    <input
      ref={inputRef}
      id={inputId}
      type="file"
      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      className="sr-only"
      tabIndex={-1}
      disabled={disabled}
      onChange={(event) => take(event.target.files?.[0])}
    />
  );
  const browse = () => inputRef.current?.click();

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-4">
        {input}
        <FileSpreadsheet className="size-8 shrink-0 text-success" aria-hidden="true" />
        <div className="grid min-w-0 flex-1">
          <span className="truncate font-medium">{file.name}</span>
          <span className="tabular text-xs text-muted-foreground">{formatSize(file.size)}</span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={browse} disabled={disabled}>
          Change
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onChange(null)}
          disabled={disabled}
          aria-label={`Remove ${file.name}`}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {input}
      {/* The whole zone opens the file picker, by mouse or with Enter or Space. */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        aria-label="Choose an Excel workbook (.xlsx) to import"
        aria-describedby={hintId}
        onClick={() => {
          if (!disabled) browse();
        }}
        onKeyDown={(event) => {
          if (disabled || (event.key !== 'Enter' && event.key !== ' ')) return;
          event.preventDefault();
          browse();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input px-6 py-10 text-center transition-colors outline-none',
          'hover:border-ring hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          dragging && 'border-ring bg-accent-soft',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <CloudUpload className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm">
          Drop the filled-in <span className="font-semibold">.xlsx</span> here, or{' '}
          <span className="font-medium text-accent-strong underline underline-offset-4">
            browse
          </span>
        </p>
        <p id={hintId} className="text-xs text-muted-foreground">
          Excel workbook, up to {maxBytes / 1024 / 1024} MB.
        </p>
      </div>
      {problem ? (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
