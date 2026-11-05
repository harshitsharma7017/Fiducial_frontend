import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { EbQuoteOptions } from './eb-quote-options';
import { SumInsuredBasisFields, type BasisValue } from './sum-insured-basis-fields';

function Harness() {
  const [value, setValue] = useState<{ basis: BasisValue }[]>([]);
  return <EbQuoteOptions value={value} onChange={setValue} disabled={false} errors={{}} />;
}

/** The Data Sheet's own basis (Option 1) above the options, as on the page. */
function PageHarness() {
  const [basis, setBasis] = useState<BasisValue>({ kind: 'FLAT', amount: '500000' });
  return (
    <form>
      <SumInsuredBasisFields value={basis} onChange={setBasis} disabled={false} errors={{}} />
      <Harness />
    </form>
  );
}

describe('the GPA and GTLI options (client review 4/11/2026)', () => {
  it('lets each option choose its own basis, leaving Option 1 as it was', async () => {
    const user = userEvent.setup();
    render(<PageHarness />);
    await user.click(screen.getByRole('button', { name: 'Add Option 2' }));
    await user.click(screen.getByRole('button', { name: 'Add Option 3' }));
    const flat = () => screen.getAllByRole('radio', { name: 'One flat amount' });
    const salary = () => screen.getAllByRole('radio', { name: 'Multiple of annual salary' });
    await user.click(flat()[1]!);
    await user.click(salary()[2]!);
    expect(flat()[0]).toBeChecked();
    expect(flat()[1]).toBeChecked();
    expect(salary()[2]).toBeChecked();
  });

  it('adds up to Option 4, and deletes an option', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Add Option 2' }));
    await user.click(screen.getByRole('button', { name: 'Add Option 3' }));
    await user.click(screen.getByRole('button', { name: 'Add Option 4' }));
    expect(screen.getByText('Option 4')).toBeVisible();
    // Four options in all: no further one can be added.
    expect(screen.queryByRole('button', { name: /^Add Option/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Delete Option 3' }));
    expect(screen.queryByText('Option 4')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add Option 4' })).toBeVisible();
  });
});
