import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatInr } from '@/lib/money';
import { coverageColumns, coverageTotals, sectionAmount } from '@/lib/proposal-metrics';
import {
  SECTION_CODES,
  SECTION_LABELS,
  SUM_INSURED_OPTION_LABELS,
  type Proposal,
} from '@/types/proposal';
import { Section } from './section-heading';

/**
 * All 14 sections in the glossary order, each marked included or not, with the sum insured per
 * option (Existing only for renewals). A totals row adds up the included sections per option.
 */
export function CoverageTable({ proposal }: { proposal: Proposal }) {
  const columns = coverageColumns(proposal);
  const totals = coverageTotals(proposal);
  const includedCount = proposal.sections.filter((section) => section.included).length;

  return (
    <Section
      title="Coverage sections"
      action={
        <span className="text-xs text-muted-foreground tabular">{includedCount}/14 included</span>
      }
    >
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Section</TableHead>
              <TableHead scope="col">Status</TableHead>
              {columns.map((option) => (
                <TableHead key={option} scope="col" className="text-right">
                  {SUM_INSURED_OPTION_LABELS[option]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {SECTION_CODES.map((code) => {
              const line = proposal.sections.find((section) => section.code === code);
              const included = line?.included ?? false;
              return (
                <TableRow key={code} className={cn(!included && 'text-muted-foreground')}>
                  <TableCell className="font-medium">{SECTION_LABELS[code]}</TableCell>
                  <TableCell>
                    {included ? (
                      'Included'
                    ) : (
                      <span className="text-muted-foreground">Not included</span>
                    )}
                  </TableCell>
                  {columns.map((option) => {
                    const amount = included ? sectionAmount(proposal, option, code) : null;
                    return (
                      <TableCell key={option} className="text-right tabular">
                        {amount === null ? '—' : formatInr(amount)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-semibold">Total of included sections</TableCell>
              <TableCell />
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
