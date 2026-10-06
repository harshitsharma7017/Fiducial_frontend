import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { buildSampleProposals } from '@/lib/data/proposals';
import { formatInr } from '@/lib/money';
import { coverageTotals } from '@/lib/proposal-metrics';
import { ProposalDrawer, type DrawerTarget } from './proposal-drawer';

// A trigger button plus the drawer, matching how the table opens it.
function Harness({ id }: { id: string }) {
  const [target, setTarget] = useState<DrawerTarget | null>(null);
  return (
    <>
      <button
        type="button"
        data-row-open
        onClick={(event) => setTarget({ id, trigger: event.currentTarget })}
      >
        Open {id}
      </button>
      <ProposalDrawer target={target} onClose={() => setTarget(null)} />
    </>
  );
}

function renderHarness(id: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <Harness id={id} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const NEW_ID = 'prp-0101';
const RENEWAL_ID = 'prp-0107';

function proposalById(id: string) {
  const proposal = buildSampleProposals().find((candidate) => candidate.id === id);
  if (!proposal) throw new Error(`sample proposal ${id} not found`);
  return proposal;
}

describe('ProposalDrawer', () => {
  it('shows Proposed 1 and Proposed 2 and no Existing column for a new proposal', async () => {
    const user = renderHarness(NEW_ID);
    await user.click(screen.getByRole('button', { name: `Open ${NEW_ID}` }));

    const dialog = await screen.findByRole('dialog');
    const headers = within(dialog)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);
    expect(headers).toContain('Proposed 1');
    expect(headers).toContain('Proposed 2');
    expect(headers).not.toContain('Existing');
  });

  it('shows Existing, Proposed 1 and Proposed 2 for a renewal', async () => {
    const user = renderHarness(RENEWAL_ID);
    await user.click(screen.getByRole('button', { name: `Open ${RENEWAL_ID}` }));

    const dialog = await screen.findByRole('dialog');
    const headers = within(dialog)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);
    expect(headers).toContain('Existing');
    expect(headers).toContain('Proposed 1');
    expect(headers).toContain('Proposed 2');
  });

  it('totals row adds up the included sections per option', async () => {
    const user = renderHarness(RENEWAL_ID);
    await user.click(screen.getByRole('button', { name: `Open ${RENEWAL_ID}` }));

    const dialog = await screen.findByRole('dialog');
    const totals = coverageTotals(proposalById(RENEWAL_ID));

    // The footer row holds the per-option totals, formatted with Indian grouping.
    const totalsRow = within(dialog).getByText('Total of included sections').closest('tr');
    expect(totalsRow).not.toBeNull();
    const row = within(totalsRow as HTMLElement);
    expect(row.getByText(formatInr(totals.EXISTING ?? '0'))).toBeInTheDocument();
    expect(row.getByText(formatInr(totals.PROPOSED_1 ?? '0'))).toBeInTheDocument();
    expect(row.getByText(formatInr(totals.PROPOSED_2 ?? '0'))).toBeInTheDocument();
  });

  it('the footer Close button returns focus to the opening button', async () => {
    const user = renderHarness(RENEWAL_ID);
    const trigger = screen.getByRole('button', { name: `Open ${RENEWAL_ID}` });
    await user.click(trigger);

    const dialog = await screen.findByRole('dialog');
    // Two controls are named "Close": the header X (with an icon) and the footer button. Click the
    // footer one, which has no icon.
    const footerClose = within(dialog)
      .getAllByRole('button', { name: 'Close' })
      .find((button) => button.querySelector('svg') === null);
    expect(footerClose).toBeDefined();
    await user.click(footerClose as HTMLElement);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('Escape closes the drawer and returns focus to the opening button', async () => {
    const user = renderHarness(RENEWAL_ID);
    const trigger = screen.getByRole('button', { name: `Open ${RENEWAL_ID}` });
    await user.click(trigger);

    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
