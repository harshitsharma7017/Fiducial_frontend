import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import type { DataSheetForm } from '@/lib/data-sheet';
import type { Cover } from '@/shared';
import { CoverToggles } from './cover-toggles';

// Fire's add-on covers, and a cover added on the case (client review, 27 Oct 2026).

const MASTER: Cover[] = [
  { name: 'Earthquake', required: null },
  { name: 'Terrorism', required: null },
];

function Answers() {
  const answers = useWatch<DataSheetForm, 'fireCovers'>({ name: 'fireCovers' }) ?? [];
  return <output aria-label="answers">{JSON.stringify(answers)}</output>;
}

function Harness({ readOnly = false }: { readOnly?: boolean }) {
  const form = useForm<DataSheetForm>({
    defaultValues: { fireCovers: [{ name: 'Terrorism', required: false }] },
  });
  return (
    <FormProvider {...form}>
      <CoverToggles path="fireCovers" covers={MASTER} name="Fire" readOnly={readOnly} />
      <Answers />
    </FormProvider>
  );
}

const answers = () => JSON.parse(screen.getByLabelText('answers').textContent ?? '[]') as Cover[];

describe('CoverToggles', () => {
  it('adds a cover the master does not list, asked for, and refuses a repeat', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Harness />);
    const input = screen.getByLabelText('Another add-on cover for Fire');
    await user.type(input, '  Terrorism on   stocks{Enter}');
    expect(answers()).toEqual([
      { name: 'Terrorism', required: false },
      { name: 'Terrorism on stocks', required: true },
    ]);
    const added = screen.getByText('Terrorism on stocks').closest('li')!;
    expect(within(added).getByRole('button', { name: 'Required' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.type(input, 'earthquake');
    await user.click(screen.getByRole('button', { name: 'Add cover' }));
    expect(screen.getByRole('alert')).toHaveTextContent('earthquake is already listed');
    expect(answers()).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Remove Terrorism on stocks' }));
    expect(answers()).toEqual([{ name: 'Terrorism', required: false }]);
    expect(screen.queryByText('Terrorism on stocks')).not.toBeInTheDocument();
  });

  it('offers no adding when read-only', () => {
    render(<Harness readOnly />);
    expect(screen.queryByLabelText('Another add-on cover for Fire')).not.toBeInTheDocument();
    expect(screen.getByText('Earthquake')).toBeInTheDocument();
  });
});
