'use client';

import type * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { Check, Download, LoaderCircle } from 'lucide-react';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Section } from '@/components/proposals/sections/section-heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePermission } from '@/hooks/use-permission';
import { apiDownload, saveFile } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  WC_DOCUMENT_LABELS,
  WC_STAGES,
  WC_STAGE_LABELS,
  type WcCase,
  type WcDocumentKind,
  type WcStage,
} from '@/shared';

/**
 * The stages in order, as the Property proposal shows them under "Progress": everything before
 * the current one marked complete; each step opens the tab where its work is done.
 */
export function WcStageStepper({
  stage,
  onSelect,
  selected,
}: {
  stage: WcStage;
  onSelect: (stage: WcStage) => void;
  /** The step whose work is shown below. */
  selected?: WcStage;
}) {
  const placed = stage === 'PLACED';
  const currentIndex = WC_STAGES.indexOf(stage);
  return (
    <Section title="Progress">
      <ol className="flex items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {WC_STAGES.map((value, index) => {
          const done = index < currentIndex || (placed && index === currentIndex);
          const current = index === currentIndex && !placed;
          return (
            <li key={value} className="flex min-w-0 shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => onSelect(value)}
                aria-current={current ? 'step' : undefined}
                aria-pressed={selected === value}
                className={cn(
                  'flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap outline-none hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring',
                  current && 'border-primary bg-primary-soft font-medium text-primary',
                  done && 'border-transparent bg-success-soft text-success',
                  !current && !done && 'border-border text-muted-foreground',
                  selected === value && 'ring-1 ring-primary/40',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-4 items-center justify-center rounded-full text-[10px] tabular',
                    current && 'bg-primary text-primary-foreground',
                    done && 'bg-success text-background',
                    !current && !done && 'bg-muted',
                  )}
                >
                  {done ? <Check className="size-2.5" /> : index + 1}
                </span>
                {WC_STAGE_LABELS[value]}
                {current ? <span className="sr-only"> (current stage)</span> : null}
                {done ? <span className="sr-only"> (completed)</span> : null}
              </button>
              {index < WC_STAGES.length - 1 ? (
                <span aria-hidden="true" className="h-px w-3 bg-border" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

const STAGE_VARIANT: Record<WcStage, React.ComponentProps<typeof Badge>['variant']> = {
  DATA_SHEET: 'muted',
  RFQ: 'info',
  QUOTES: 'info',
  QCR: 'warning',
  PLACEMENT_SLIP: 'accent',
  PLACED: 'success',
};

/** A case's stage, in the colours of the Property proposal's stages. */
export function WcStageBadge({ stage }: { stage: WcStage }) {
  return <Badge variant={STAGE_VARIANT[stage]}>{WC_STAGE_LABELS[stage]}</Badge>;
}

/** The PDF and Excel downloads of one document of a case (wc.export). */
export function WcDocumentButtons({
  record,
  kind,
  disabledReason,
}: {
  record: WcCase;
  kind: WcDocumentKind;
  /** Why the document cannot be made yet; the buttons are off. */
  disabledReason?: string | null;
}) {
  const canExport = usePermission('wc.export');
  const download = useMutation({
    mutationFn: (format: 'pdf' | 'xlsx') =>
      apiDownload(
        `wc/cases/${record.id}/documents/${kind}?format=${format}`,
        `WC-${kind}-${record.reference}.${format}`,
      ),
    onSuccess: saveFile,
  });
  if (!canExport) return null;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{WC_DOCUMENT_LABELS[kind]}</span>
        {(['pdf', 'xlsx'] as const).map((format) => (
          <Button
            key={format}
            type="button"
            size="sm"
            variant="outline"
            disabled={download.isPending || Boolean(disabledReason)}
            aria-label={`Download the ${WC_DOCUMENT_LABELS[kind]} as ${format === 'pdf' ? 'PDF' : 'Excel'}`}
            onClick={() => download.mutate(format)}
          >
            {download.isPending && download.variables === format ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Download aria-hidden="true" />
            )}
            {format === 'pdf' ? 'PDF' : 'Excel'}
          </Button>
        ))}
        {disabledReason ? (
          <span className="text-xs text-muted-foreground">{disabledReason}</span>
        ) : null}
      </div>
      {download.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{errorMessage(download.error)}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
