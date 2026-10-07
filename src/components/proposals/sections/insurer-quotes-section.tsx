import { formatDate, formatDateTime } from '@/shared';
import type { Proposal } from '@/types/proposal';
import { InsurerStatusBadge, OverdueBadge } from '../badges';
import { Section } from './section-heading';

/** Up to five insurers with a status badge each; says so when none is selected. */
export function InsurerQuotesSection({ proposal }: { proposal: Proposal }) {
  const insurers = proposal.insurers;

  return (
    <Section
      title="Insurers and quotes"
      action={
        insurers.length > 0 ? (
          <span className="text-xs text-muted-foreground tabular">{insurers.length} of 5</span>
        ) : undefined
      }
    >
      {insurers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No insurer has been selected yet.</p>
      ) : (
        <ul className="grid gap-2">
          {insurers.map((insurer) => (
            <li
              key={insurer.insurer}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
            >
              <div className="grid gap-0.5">
                <span className="text-sm font-medium">{insurer.insurer}</span>
                {insurer.updatedAt ? (
                  <span className="text-xs text-muted-foreground tabular">
                    Updated {formatDateTime(insurer.updatedAt)}
                  </span>
                ) : null}
                {insurer.dueDate ? (
                  <span className="text-xs text-muted-foreground tabular">
                    Quote due {formatDate(insurer.dueDate)}
                  </span>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {insurer.overdue ? <OverdueBadge /> : null}
                <InsurerStatusBadge status={insurer.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
