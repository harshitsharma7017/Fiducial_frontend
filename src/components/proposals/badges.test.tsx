import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { INSURER_STATUSES, INSURER_STATUS_LABELS } from '@/shared';
import { InsurerStatusBadge, OverdueBadge } from './badges';

describe('InsurerStatusBadge', () => {
  it.each(INSURER_STATUSES)('labels %s in words, from the shared vocabulary', (status) => {
    render(<InsurerStatusBadge status={status} />);
    expect(screen.getByText(INSURER_STATUS_LABELS[status])).toBeInTheDocument();
  });

  it('uses the plan’s labels', () => {
    expect(INSURER_STATUSES.map((status) => INSURER_STATUS_LABELS[status])).toEqual([
      'Not sent',
      'Sent',
      'Reminded',
      'Quoted',
      'Declined',
      'No response',
    ]);
  });

  it('says Overdue in text, not colour alone', () => {
    render(<OverdueBadge />);
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });
});
