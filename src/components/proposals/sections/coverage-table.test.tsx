import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildSampleProposals } from '@/lib/data/proposals';
import { formatInr } from '@/lib/money';
import { coverageTotals } from '@/lib/proposal-metrics';
import { SECTION_CODES, SECTION_LABELS, type Proposal } from '@/types/proposal';
import { CoverageTable } from './coverage-table';

// B5 in the proposal drawer: only the sections the case includes are listed (the shared
// isSectionShown rule); the others are not shown as "Not included" rows, and their figures stay
// on the case.

function sample(): Proposal {
  const proposal = buildSampleProposals().find((item) => item.id === 'prp-0107');
  if (!proposal) throw new Error('sample proposal prp-0107 not found');
  return proposal;
}

/** The sample with exactly these sections included; every section keeps its figures. */
function withIncluded(codes: readonly string[]): Proposal {
  const proposal = sample();
  return {
    ...proposal,
    sections: proposal.sections.map((section) => ({
      ...section,
      included: codes.includes(section.code),
    })),
  } as Proposal;
}

const rowNames = () =>
  within(screen.getAllByRole('rowgroup')[1]!)
    .getAllByRole('row')
    .map((row) => within(row).getAllByRole('cell')[0]!.textContent);

describe('CoverageTable (B5)', () => {
  it('lists only included sections, in the glossary order, and never "Not included"', () => {
    const proposal = sample();
    const included = proposal.sections.filter((section) => section.included).map((s) => s.code);
    expect(included.length).toBeGreaterThan(0);
    expect(included.length).toBeLessThan(proposal.sections.length);
    render(<CoverageTable proposal={proposal} />);
    expect(rowNames()).toEqual(
      SECTION_CODES.filter((code) => included.includes(code)).map((code) => SECTION_LABELS[code]),
    );
    expect(screen.queryByText('Not included')).not.toBeInTheDocument();
    expect(
      screen.getByText(`${included.length}/${SECTION_CODES.length} included`),
    ).toBeInTheDocument();
    // The total adds up the listed sections only, as before.
    const totals = coverageTotals(proposal);
    const footer = within(screen.getByText('Total of included sections').closest('tr')!);
    expect(footer.getByText(formatInr(totals.PROPOSED_1 ?? '0'))).toBeInTheDocument();
  });

  it('follows a change of inclusion, and keeps a hidden section’s figures on the case', () => {
    const first = SECTION_CODES[0];
    const second = SECTION_CODES[1];
    const both = withIncluded([first, second]);
    const { rerender } = render(<CoverageTable proposal={both} />);
    expect(rowNames()).toEqual([SECTION_LABELS[first], SECTION_LABELS[second]]);

    const one = withIncluded([first]);
    rerender(<CoverageTable proposal={one} />);
    expect(rowNames()).toEqual([SECTION_LABELS[first]]);
    expect(screen.queryByText(SECTION_LABELS[second])).not.toBeInTheDocument();
    // Hiding is display only: the second section's figures are unchanged on the case.
    expect(one.sections.find((section) => section.code === second)?.sumInsured).toEqual(
      both.sections.find((section) => section.code === second)?.sumInsured,
    );

    rerender(<CoverageTable proposal={withIncluded([])} />);
    expect(screen.getByText('No coverage section is included yet.')).toBeInTheDocument();
  });

  it('keeps an included section listed whatever its figures (zero is not "not required")', () => {
    const first = SECTION_CODES[0];
    const proposal = withIncluded([first]);
    const zeroed = {
      ...proposal,
      sections: proposal.sections.map((section) =>
        section.code === first
          ? {
              ...section,
              sumInsured: Object.fromEntries(
                Object.keys(section.sumInsured).map((key) => [key, '0']),
              ),
            }
          : section,
      ),
    } as Proposal;
    render(<CoverageTable proposal={zeroed} />);
    expect(rowNames()).toEqual([SECTION_LABELS[first]]);
  });
});
