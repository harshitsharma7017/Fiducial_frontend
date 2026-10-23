'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePermission } from '@/hooks/use-permission';
import { formatDateTime } from '@/shared';
import { DOCUMENT_KINDS, DOCUMENT_KIND_LABELS, type Proposal } from '@/types/proposal';
import { DocStatusBadge } from '../badges';
import { Section } from './section-heading';

/**
 * The four documents with status badges. Users who may export (property.export) also see the
 * download buttons, disabled and marked "Coming soon" until document export is built.
 */
export function DocumentsSection({ proposal }: { proposal: Proposal }) {
  const canExport = usePermission('property.export');

  return (
    <Section title="Documents">
      <ul className="grid gap-2">
        {DOCUMENT_KINDS.map((kind) => {
          const doc = proposal.documents.find((candidate) => candidate.kind === kind);
          const status = doc?.status ?? 'NOT_STARTED';
          return (
            <li
              key={kind}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
            >
              <div className="grid gap-0.5">
                <span className="text-sm font-medium">{DOCUMENT_KIND_LABELS[kind]}</span>
                {doc?.updatedAt ? (
                  <span className="text-xs text-muted-foreground tabular">
                    Updated {formatDateTime(doc.updatedAt)}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <DocStatusBadge status={status} />
                {canExport ? (
                  <Button variant="outline" size="sm" disabled title="Coming soon">
                    <Download aria-hidden="true" />
                    Download{' '}
                    <span className="sr-only">{DOCUMENT_KIND_LABELS[kind]} (coming soon)</span>
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
