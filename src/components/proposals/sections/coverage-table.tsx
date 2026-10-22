import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatInr } from '@/lib/money';
import { coverageColumns, coverageTotals, sectionAmount } from '@/lib/proposal-metrics';
import { isSectionShown } from '@/shared';
import {
  SECTION_CODES,
  SECTION_LABELS,
  SUM_INSURED_OPTION_LABELS,
  type Proposal,
} from '@/types/proposal';
import { Section } from './section-heading';

/**
 * The coverage sections the case includes, in the glossary order, with the sum insured per option
 * (Existing only for renewals). B5: a section not marked required is not listed (the same rule as
 * the RFQ, QCR and documents, `isSectionShown`); its figures stay on the case. A totals row adds
 * up the listed sections per option.
 */
export function CoverageTable({ proposal }: { proposal: Proposal }) {
  const columns = coverageColumns(proposal);
  const totals = coverageTotals(proposal);
  const shown = SECTION_CODES.filter((code) =>
    proposal.sections.some((section) => section.code === code && isSectionShown(section)),
  );

  return (
    <Section
      title="Coverage sections"
      action={
        <span className="text-xs text-muted-foreground tabular">
          {shown.length}/{SECTION_CODES.length} included
        </span>
      }
    >
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Section</TableHead>
              {columns.map((option) => (
                <TableHead key={option} scope="col" className="text-right">
                  {SUM_INSURED_OPTION_LABELS[option]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="text-muted-foreground">
                  No coverage section is included yet.
                </TableCell>
              </TableRow>
            ) : (
              shown.map((code) => (
                <TableRow key={code}>
                  <TableCell className="font-medium">{SECTION_LABELS[code]}</TableCell>
                  {columns.map((option) => {
                    const amount = sectionAmount(proposal, option, code);
                    return (
                      <TableCell key={option} className="text-right tabular">
                        {amount === null ? '—' : formatInr(amount)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-semibold">Total of included sections</TableCell>
              {columns.map((option) => (
                <TableCell key={option} className="text-right font-semibold tabular">
                  {totals[option] === undefined ? '—' : formatInr(totals[option])}
                </TableCell>
              ))}
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </Section>
  );
}
