import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { EbQuoteOptions } from './eb-quote-options';
import type { BasisValue } from './sum-insured-basis-fields';

function Harness() {
  const [value, setValue] = useState<{ basis: BasisValue }[]>([]);
  return <EbQuoteOptions value={value} onChange={setValue} disabled={false} errors={{}} />;
}

describe('the GPA and GTLI options (client review 4/11/2026)', () => {
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
