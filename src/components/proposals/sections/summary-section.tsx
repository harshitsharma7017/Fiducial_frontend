import { formatDate } from '@/shared';
import { PRODUCT_NAMES, type Proposal } from '@/types/proposal';
import { StageBadge, TypeBadge } from '../badges';
import { Field, Section } from './section-heading';

/** Type, product, policy period, stage and owner; for renewals, the existing policy too. */
export function SummarySection({ proposal }: { proposal: Proposal }) {
  return (
    <Section title="Summary">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label="Type">
          <TypeBadge type={proposal.type} />
        </Field>
        <Field label="Stage">
          <StageBadge stage={proposal.stage} />
        </Field>
        <Field label="Owner">{proposal.owner}</Field>
        <Field label="Policy">
          {proposal.product ? (
            <abbr title={PRODUCT_NAMES[proposal.product]} className="no-underline">
              {proposal.product}
            </abbr>
          ) : (
            <span className="text-muted-foreground">Chosen at QCR</span>
          )}
        </Field>
        <Field label="Policy period">
          {proposal.policyPeriod ? (
            <span className="tabular">
              {formatDate(proposal.policyPeriod.start)} – {formatDate(proposal.policyPeriod.end)}
            </span>
          ) : (
            <span className="text-muted-foreground">1 year from date of payment</span>
          )}
        </Field>
        <Field label="Client">
          {proposal.client.name}
          <span className="block text-xs font-normal text-muted-foreground">
            {proposal.client.city}
          </span>
        </Field>
        {proposal.type === 'EXISTING' ? (
          <>
            <Field label="Existing insurer">{proposal.existingPolicy.insurer}</Field>
            <Field label="Policy number">
              <span className="tabular">{proposal.existingPolicy.policyNumber}</span>
            </Field>
            <Field label="Expires on">
              <span className="tabular">{formatDate(proposal.existingPolicy.expiresOn)}</span>
            </Field>
          </>
        ) : (
          <Field label="Due date">
            <span className="tabular">{formatDate(proposal.dueDate)}</span>
          </Field>
        )}
      </dl>
    </Section>
  );
}
