'use client';

import { CircleCheck, CircleSlash, LoaderCircle, RotateCcw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { SendResult } from '@/shared';

/**
 * What a send did for each insurer: a line for each mail that went (or was already sent), and an
 * alert with the reason and "Try again" for each failure (requirement 5.3).
 */
export function SendResults({
  results,
  onRetry,
  retrying,
}: {
  results: readonly SendResult[];
  onRetry?: (insurerId: string) => void;
  /** The insurer being tried again, if any. */
  retrying?: string | null;
}) {
  return (
    <ul className="grid gap-2" aria-label="Send results">
      {results.map((result) => (
        <li key={result.insurerId}>
          {result.outcome === 'FAILED' ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Not sent to {result.insurerName}</AlertTitle>
              <AlertDescription className="grid gap-2">
                <span>{result.reason ?? 'The mail could not be sent.'}</span>
                {onRetry ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="justify-self-start"
                    aria-label={`Try again for ${result.insurerName}`}
                    disabled={retrying !== null && retrying !== undefined}
                    onClick={() => onRetry(result.insurerId)}
                  >
                    {retrying === result.insurerId ? (
                      <LoaderCircle className="animate-spin" aria-hidden="true" />
                    ) : (
                      <RotateCcw aria-hidden="true" />
                    )}
                    Try again
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : (
            <p className="flex items-start gap-2 text-sm">
              {result.outcome === 'SENT' ? (
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
              ) : (
                <CircleSlash
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              <span>
                {result.outcome === 'SENT'
                  ? `Sent to ${result.insurerName}`
                  : `Not sent now: ${result.reason ?? result.insurerName}`}
              </span>
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
