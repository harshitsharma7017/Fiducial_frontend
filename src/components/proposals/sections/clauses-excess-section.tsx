import { Badge } from '@/components/ui/badge';
import { SECTION_LABELS, type Proposal } from '@/types/proposal';
import { Section } from './section-heading';

const PREVIEW = 6;

/** The number of clauses and excess entries, with a short summary of each. */
export function ClausesExcessSection({ proposal }: { proposal: Proposal }) {
  const clauses = proposal.clauses;
  const excess = proposal.excess;
  const shownClauses = clauses.slice(0, PREVIEW);
  const extraClauses = clauses.length - shownClauses.length;

  return (
    <Section
      title="Clauses and excess"
      action={
        <span className="text-xs text-muted-foreground tabular">
          {clauses.length} clause{clauses.length === 1 ? '' : 's'} · {excess.length} excess
        </span>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <p className="text-xs text-muted-foreground">Clauses</p>
          {clauses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No clauses attached yet.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {shownClauses.map((name) => (
                <li key={name}>
                  <Badge variant="muted">{name}</Badge>
                </li>
              ))}
              {extraClauses > 0 ? (
                <li>
                  <Badge variant="outline">+{extraClauses} more</Badge>
                </li>
              ) : null}
            </ul>
          )}
        </div>
        <div className="grid gap-1.5">
          <p className="text-xs text-muted-foreground">Excess</p>
          {excess.length === 0 ? (
            <p className="text-sm text-muted-foreground">No excess entries yet.</p>
          ) : (
            <ul className="grid gap-1 text-sm">
              {excess.map((entry) => (
                <li key={entry.section} className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{SECTION_LABELS[entry.section]}</span>
                  <span className="text-right text-muted-foreground">{entry.note}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Section>
  );
}
