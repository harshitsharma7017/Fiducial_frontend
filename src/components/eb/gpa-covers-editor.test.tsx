import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { GpaCoversEditor, type GpaCoversValue } from './gpa-covers-editor';

function Harness({ onTemporaryTotalCleared }: { onTemporaryTotalCleared: () => void }) {
  const [value, setValue] = useState<GpaCoversValue>({
    covers: {
      accidentalDeath: 'REQUIRED',
      permanentTotal: 'REQUIRED',
      permanentPartial: null,
      temporaryTotal: 'REQUIRED',
    },
    removedCovers: [],
    customCovers: [],
  });
  return (
    <>
      <GpaCoversEditor
        value={value}
        disabled={false}
        errors={{}}
        onChange={setValue}
        onTemporaryTotalCleared={onTemporaryTotalCleared}
      />
      <output data-testid="value">{JSON.stringify(value)}</output>
    </>
  );
}

const current = () => JSON.parse(screen.getByTestId('value').textContent ?? '{}') as GpaCoversValue;

describe('the GPA covers (alteration 3/11/2026)', () => {
  it('deletes and restores a standard cover, and adds and deletes covers of its own', async () => {
    const user = userEvent.setup();
    const cleared = vi.fn();
    render(<Harness onTemporaryTotalCleared={cleared} />);
    const covers = () => screen.getByRole('list', { name: 'Covers' });
    expect(within(covers()).getAllByRole('listitem')).toHaveLength(4);

    await user.click(screen.getByRole('button', { name: 'Delete Temporary total disablement' }));
    expect(within(covers()).getAllByRole('listitem')).toHaveLength(3);
    expect(current()).toMatchObject({
      removedCovers: ['temporaryTotal'],
      covers: { temporaryTotal: null },
    });
    expect(cleared).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Add cover' }));
    await user.type(screen.getByLabelText('Cover name'), 'Medical expenses');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Medical expenses: required or not' }),
      'REQUIRED',
    );
    await user.type(screen.getByLabelText('Limit asked for (optional)'), '10% of the claim');
    expect(current().customCovers).toEqual([
      { id: 'c1', name: 'Medical expenses', choice: 'REQUIRED', limit: '10% of the claim' },
    ]);

    await user.click(screen.getByRole('button', { name: 'Restore Temporary total disablement' }));
    expect(current().removedCovers).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Delete Medical expenses' }));
    expect(current().customCovers).toEqual([]);
    expect(within(covers()).getAllByRole('listitem')).toHaveLength(4);
  });
});
