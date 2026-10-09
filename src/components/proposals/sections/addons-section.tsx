import { Badge } from '@/components/ui/badge';
import type { Proposal } from '@/types/proposal';
import { Section } from './section-heading';

const PREVIEW = 6;

/** How many add-ons are selected out of the product's catalogue, with the first few names. */
export function AddonsSection({ proposal }: { proposal: Proposal }) {
  if (!proposal.addOns) {
    return (
      <Section title="Add-ons">
        <p className="text-sm text-muted-foreground">Chosen with the policy at the QCR stage.</p>
      </Section>
    );
  }
  const { selected, catalogueSize } = proposal.addOns;
  const shown = selected.slice(0, PREVIEW);
  const extra = selected.length - shown.length;

  return (
    <Section
      title="Add-ons"
      action={
        <span className="text-xs text-muted-foreground tabular">
          {selected.length} of {catalogueSize} selected
        </span>
      }
    >
      {selected.length === 0 ? (
        <p className="text-sm text-muted-foreground">No add-ons selected yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {shown.map((name) => (
            <li key={name}>
              <Badge variant="muted">{name}</Badge>
            </li>
          ))}
          {extra > 0 ? (
            <li>
              <Badge variant="outline">+{extra} more</Badge>
            </li>
          ) : null}
        </ul>
      )}
    </Section>
  );
}
