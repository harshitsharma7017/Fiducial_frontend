import { describe, expect, it } from 'vitest';
import type { ProposalInsurer } from '@/shared';
import { countByStatus, lastSent, matchesSearch, parseRfqStatus, rfqStatusOf } from './rfq-status';

function insurer(status: 'SENT' | 'NOT_SENT', sentAt: string | null = null): ProposalInsurer {
  return {
    insurerId: 'a'.repeat(24),
    company: 'Example General Insurance',
    branch: 'Pune',
    rfqEmails: [],
    active: true,
    status,
    sentAt,
    sentBy: sentAt ? 'Asha Rao' : null,
  };
}

describe('rfqStatusOf', () => {
  it('is not ready while the Data Sheet misses something and nothing went out', () => {
    expect(rfqStatusOf({ missing: ['x'], insurers: [] })).toBe('NOT_READY');
  });

  it('is ready once the Data Sheet is complete, with or without insurers chosen', () => {
    expect(rfqStatusOf({ missing: [], insurers: [] })).toBe('READY');
    expect(rfqStatusOf({ missing: [], insurers: [insurer('NOT_SENT')] })).toBe('READY');
  });

  it('is partly sent while some chosen insurers lack the RFQ, then sent', () => {
    const one = insurer('SENT', '2026-10-07T06:00:00.000Z');
    expect(rfqStatusOf({ missing: [], insurers: [one, insurer('NOT_SENT')] })).toBe('PARTLY_SENT');
    expect(rfqStatusOf({ missing: [], insurers: [one, one] })).toBe('SENT');
  });
});

describe('helpers', () => {
  it('finds the latest send', () => {
    expect(lastSent({ insurers: [insurer('NOT_SENT')] })).toBeNull();
    expect(
      lastSent({
        insurers: [
          insurer('SENT', '2026-10-07T06:00:00.000Z'),
          insurer('SENT', '2026-10-08T06:00:00.000Z'),
        ],
      }),
    ).toEqual({ at: '2026-10-08T06:00:00.000Z', by: 'Asha Rao' });
  });

  it('counts each status', () => {
    expect(
      countByStatus([
        { missing: ['x'], insurers: [] },
        { missing: [], insurers: [] },
        { missing: [], insurers: [insurer('SENT', '2026-10-07T06:00:00.000Z')] },
      ]),
    ).toEqual({ NOT_READY: 1, READY: 1, PARTLY_SENT: 0, SENT: 1 });
  });

  it('parses the status filter and searches reference, client and insurer', () => {
    expect(parseRfqStatus('partly-sent')).toBe('PARTLY_SENT');
    expect(parseRfqStatus('bogus')).toBeNull();
    const record = {
      reference: 'PRP-2026-0002',
      client: {
        id: 'b'.repeat(24),
        name: 'Ahmedabad Fabric Solutions',
        gstin: null,
        city: '',
        state: '',
      },
      insurers: [insurer('NOT_SENT')],
    };
    expect(matchesSearch(record, 'fabric 0002')).toBe(true);
    expect(matchesSearch(record, 'example general')).toBe(true);
    expect(matchesSearch(record, 'steel')).toBe(false);
  });
});
