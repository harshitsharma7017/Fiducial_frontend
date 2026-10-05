'use client';

import { CircleAlert, Inbox, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TableCell, TableRow } from '@/components/ui/table';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.name === 'ZodError')
    return 'The server sent an unexpected response.';
  return 'Something went wrong. Try again.';
}

/** Announced politely to screen readers while data loads. */
export function LoadingState({
  label = 'Loading…',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={cn('grid gap-2', className)}>
      <span className="sr-only">{label}</span>
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

export function TableLoadingRows({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <TableRow key={row} aria-hidden="true">
          {Array.from({ length: columns }, (_, column) => (
            <TableCell key={column}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  className,
}: {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-4 py-10 text-center', className)}>
      <span className="text-muted-foreground" aria-hidden="true">
        {icon ?? <Inbox className="size-8" />}
      </span>
      <p className="font-medium">{title}</p>
      {description ? (
        <div className="max-w-md text-sm text-muted-foreground">{description}</div>
      ) : null}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title = 'Could not load this',
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <Alert variant="destructive" role="alert">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{errorMessage(error)}</p>
        {onRetry ? (
          <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

export function isMasterNotActive(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'MASTER_NOT_ACTIVE';
}

export function MasterNotActiveState() {
  return (
    <EmptyState
      title="No master data is active yet"
      description={
        <>
          An admin imports the IIB workbook from the Fiducial_backend repository with{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            npm run import:masters -- data/IIB_Code_Master.xlsx --activate
          </code>
          .
        </>
      }
    />
  );
}
