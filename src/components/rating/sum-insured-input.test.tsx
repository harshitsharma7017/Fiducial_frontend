import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { SumInsuredInput } from './sum-insured-input';

function Harness() {
  const [value, setValue] = useState('');
  return (
    <>
      <label htmlFor="si">Sum insured</label>
      <SumInsuredInput id="si" value={value} onValueChange={setValue} />
      <output data-testid="raw">{value}</output>
    </>
  );
}

describe('SumInsuredInput', () => {
  it('shows Indian digit grouping while keeping the plain value', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Sum insured');

    await user.type(input, '100000000');
    expect(input).toHaveValue('10,00,00,000');
    expect(screen.getByTestId('raw')).toHaveTextContent('100000000');
  });

  it('accepts up to two decimals and ignores other characters', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Sum insured');

    await user.type(input, '2500000.756x');
    expect(input).toHaveValue('25,00,000.75');
    expect(screen.getByTestId('raw')).toHaveTextContent('2500000.75');
  });
});
