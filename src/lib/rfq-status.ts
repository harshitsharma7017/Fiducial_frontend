import type { ProposalRecord } from '@/shared';

// Where each new-business proposal stands with its RFQ, for the RFQ page.

export const RFQ_STATUSES = ['NOT_READY', 'READY', 'PARTLY_SENT', 'SENT'] as const;
export type RfqStatus = (typeof RFQ_STATUSES)[number];

export const RFQ_STATUS_LABELS: Record<RfqStatus, string> = {
  NOT_READY: 'Data Sheet incomplete',
  READY: 'Ready to send',
  PARTLY_SENT: 'Partly sent',
  SENT: 'Sent',
};

/** URL values for the status filter (?status=). */
export const RFQ_STATUS_SLUGS: Record<RfqStatus, string> = {
  NOT_READY: 'not-ready',
  READY: 'ready',
  PARTLY_SENT: 'partly-sent',
  SENT: 'sent',
};

export function parseRfqStatus(value: string | null): RfqStatus | null {
  const match = RFQ_STATUSES.find((status) => RFQ_STATUS_SLUGS[status] === value);
  return match ?? null;
}

/**
 * Not ready while the Data Sheet misses something; ready once it is complete and nothing has
 * gone out; partly sent while some chosen insurers still lack it; sent when all have it.
 */
export function rfqStatusOf(record: Pick<ProposalRecord, 'missing' | 'insurers'>): RfqStatus {
  const sent = record.insurers.filter((insurer) => insurer.status === 'SENT').length;
  if (sent === 0) return record.missing.length > 0 ? 'NOT_READY' : 'READY';
  return sent < record.insurers.length ? 'PARTLY_SENT' : 'SENT';
}

/** The latest send, if any. */
export function lastSent(
  record: Pick<ProposalRecord, 'insurers'>,
): { at: string; by: string | null } | null {
  let latest: { at: string; by: string | null } | null = null;
  for (const insurer of record.insurers) {
    if (insurer.sentAt && (!latest || insurer.sentAt > latest.at)) {
      latest = { at: insurer.sentAt, by: insurer.sentBy };
    }
  }
  return latest;
}

export function countByStatus(
  records: readonly Pick<ProposalRecord, 'missing' | 'insurers'>[],
): Record<RfqStatus, number> {
  const counts: Record<RfqStatus, number> = { NOT_READY: 0, READY: 0, PARTLY_SENT: 0, SENT: 0 };
  for (const record of records) counts[rfqStatusOf(record)] += 1;
  return counts;
}

/** Matches words of the reference, client name or an insurer's company. */
export function matchesSearch(
  record: Pick<ProposalRecord, 'reference' | 'client' | 'insurers'>,
  q: string,
): boolean {
  const text = [record.reference, record.client.name, ...record.insurers.map((i) => i.company)]
    .join(' ')
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word));
}
