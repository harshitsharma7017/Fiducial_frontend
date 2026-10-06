import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/button';
import type { Occupancy } from '@/shared';
import { OccupancyFormSheet } from './occupancy-form-sheet';

const OCCUPANCY: Occupancy = {
  id: 'a00000000000000000000001',
  versionId: 'b00000000000000000000001',
  serialNo: 3,
  tacCode: '2001',
  description: 'Abrasive Manufacturing',
  riskGrade: 'RG3',
  iibRate: '0.69',
  iibRateNote: null,
  fireRiskType: 'INDUSTRIAL',
  terrorismRiskType: 'INDUSTRIAL',
  minStfiRate: '0.37',
  minEqRates: { zone1: '0.5', zone2: '0.25', zone3: '0.1', zone4: '0.05' },
};

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();

function renderSheet(occupancy?: Occupancy) {
  const onSaved = vi.fn();
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <OccupancyFormSheet occupancy={occupancy} onSaved={onSaved} trigger={<Button>Open</Button>} />
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), onSaved };
}

describe('OccupancyFormSheet', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('corrects a rate and clears another, sending blanks as null', async () => {
    fetchMock.mockImplementation((_input, init) =>
      Promise.resolve(
        new Response(
          JSON.stringify({ ...OCCUPANCY, ...(JSON.parse(init!.body as string) as object) }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    );
    const { user, onSaved } = renderSheet(OCCUPANCY);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByLabelText('TAC code')).toBeDisabled();
    await user.clear(screen.getByLabelText('IIB rate'));
    await user.type(screen.getByLabelText('IIB rate'), '0.75');
    await user.clear(screen.getByLabelText('Min EQ Zone III'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/proxy/masters/occupancies/2001');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(init!.body as string)).toEqual({
      description: 'Abrasive Manufacturing',
      riskGrade: 'RG3',
      iibRate: '0.75',
      iibRateNote: null,
      fireRiskType: 'INDUSTRIAL',
      terrorismRiskType: 'INDUSTRIAL',
      minStfiRate: '0.37',
      minEqRates: { zone1: '0.5', zone2: '0.25', zone3: null, zone4: '0.05' },
    });
  });

  it('checks the values before sending', async () => {
    const { user } = renderSheet();
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.type(screen.getByLabelText('IIB rate'), '-1');
    await user.click(screen.getByRole('button', { name: 'Add occupancy' }));
    expect(await screen.findByText('Enter an occupancy code')).toBeInTheDocument();
    expect(screen.getByText('Enter the occupancy description')).toBeInTheDocument();
    expect(screen.getByText('Enter a rate per mille, for example 0.05')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
