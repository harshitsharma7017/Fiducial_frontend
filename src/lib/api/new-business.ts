import { queryOptions, skipToken } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { addDays } from '@/lib/dates';
import { isDemoModeError } from '@/lib/demo-mode';
import { queryKeys } from '@/lib/query-keys';
import {
  ClientLocationListResponseSchema,
  ProposalListResponseSchema,
  ProposalRecordSchema,
  hasRfq,
  wholeRupees,
  type ClientLocation,
  type ProposalRecord,
} from '@/shared';
import type { DocStatus, Proposal, ProposalType } from '@/types/proposal';

// Cases (new business and renewals) come from Fiducial_backend (/api/v1/proposals); demo mode
// shows the sample data instead. This file reads the API and maps a case onto the screen model,
// so the dashboard, list, drawer and palette show both kinds the same way.

/** Real proposals have database ids; sample ones look like prp-0101. */
export function isRecordId(id: string): boolean {
  return /^[a-f0-9]{24}$/i.test(id);
}

/** Every case of a type (or of both), newest first. Null in demo mode, which has no API. */
export async function fetchCases(type?: ProposalType): Promise<ProposalRecord[] | null> {
  const records: ProposalRecord[] = [];
  let cursor: string | null = null;
  try {
    do {
      const query = new URLSearchParams({ limit: '100' });
      if (type) query.set('type', type);
      if (cursor) query.set('cursor', cursor);
      const page = await apiFetch(`proposals?${query.toString()}`, {
        schema: ProposalListResponseSchema,
      });
      records.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
  } catch (error) {
    if (isDemoModeError(error)) return null;
    throw error;
  }
  return records;
}

export function fetchProposalRecord(id: string, signal?: AbortSignal): Promise<ProposalRecord> {
  return apiFetch(`proposals/${id}`, { schema: ProposalRecordSchema, signal });
}

/** One new-business proposal as the API returns it, for its workspace. */
export function proposalRecordQuery(id: string) {
  return queryOptions({
    queryKey: queryKeys.proposals.record(id),
    queryFn: isRecordId(id) ? ({ signal }) => fetchProposalRecord(id, signal) : skipToken,
  });
}

/** Every risk location of a client (none when no client is chosen yet). */
export function clientLocationsQuery(clientId: string | null) {
  return queryOptions({
    queryKey: queryKeys.clients.allLocations(clientId ?? ''),
    queryFn:
      clientId && isRecordId(clientId)
        ? async ({ signal }) => {
            const items: ClientLocation[] = [];
            let cursor: string | null = null;
            do {
              const query = new URLSearchParams({ limit: '100' });
              if (cursor) query.set('cursor', cursor);
              const page = await apiFetch(`clients/${clientId}/locations?${query.toString()}`, {
                schema: ClientLocationListResponseSchema,
                signal,
              });
              items.push(...page.items);
              cursor = page.nextCursor;
            } while (cursor);
            return items;
          }
        : skipToken,
  });
}

function documentStatuses(record: ProposalRecord): Proposal['documents'] {
  const sent = record.insurers.filter((insurer) => hasRfq(insurer.status));
  const lastSent = sent
    .map((insurer) => insurer.sentAt)
    .filter((at): at is string => at !== null)
    .sort()
    .at(-1);
  const complete = record.missing.length === 0;
  const dataSheet: DocStatus = complete ? 'READY' : 'DRAFT';
  const rfq: DocStatus = sent.length > 0 ? 'SENT' : complete ? 'READY' : 'NOT_STARTED';
  return [
    { kind: 'DATA_SHEET', status: dataSheet, updatedAt: record.updatedAt },
    { kind: 'RFQ', status: rfq, updatedAt: lastSent ?? (complete ? record.updatedAt : null) },
    { kind: 'QCR', status: 'NOT_STARTED', updatedAt: null },
    { kind: 'PLACEMENT_SLIP', status: 'NOT_STARTED', updatedAt: null },
  ];
}

// Sums insured from area × rate can carry paise; the screens show whole rupees.
const rupees = (value: string | null) => wholeRupees(value ?? '0');

/** A case from the API as the screens' model. Product and add-ons wait for the QCR. */
export function toScreenProposal(record: ProposalRecord): Proposal {
  const base = {
    id: record.id,
    reference: record.reference,
    client: { name: record.client.name, city: record.client.city || record.client.state || '—' },
    product: null,
    stage: record.stage,
    owner: record.owner.name,
    addOns: null,
    clauses: [],
    excess: [],
    insurers: record.insurers.map((insurer) => ({
      insurer: `${insurer.company}, ${insurer.branch}`,
      status: insurer.status,
      updatedAt: insurer.response?.at ?? insurer.lastRemindedAt ?? insurer.sentAt,
      dueDate: insurer.dueDate,
      overdue: insurer.overdue,
    })),
    documents: documentStatuses(record),
    activity: record.activity.map((entry) => ({
      at: entry.at,
      actor: entry.actor,
      message: entry.message,
    })),
    placedOn: null,
  };
  const period = record.policyStart
    ? { start: record.policyStart, end: record.policyEnd ?? addDays(record.policyStart, 364) }
    : null;

  if (record.type === 'EXISTING') {
    const existing = record.existingPolicy;
    const existingOf = (code: string) =>
      rupees(existing?.sections.find((section) => section.code === code)?.sumInsured ?? null);
    const start = record.policyStart ?? record.dueDate;
    return {
      ...base,
      type: 'EXISTING',
      policyPeriod: period ?? { start, end: addDays(start, 364) },
      existingPolicy: {
        insurer: existing?.insurer ?? 'Not yet fetched',
        policyNumber: existing?.policyNumber ?? '—',
        // Last year's policy ends the day before the renewal starts.
        expiresOn: existing?.periodEnd ?? addDays(start, -1),
      },
      sections: [
        {
          code: 'FIRE',
          included: true,
          sumInsured: {
            existing: existingOf('FIRE'),
            proposed1: rupees(record.fire.proposed1),
            proposed2: rupees(record.fire.proposed2),
          },
        },
        ...record.sections.map((section) => ({
          code: section.code,
          included: section.included,
          sumInsured: {
            existing: existingOf(section.code),
            proposed1: rupees(section.proposed1),
            proposed2: rupees(section.proposed2),
          },
        })),
      ],
    };
  }

  return {
    ...base,
    type: 'NEW',
    policyPeriod: period,
    dueDate: record.dueDate,
    sections: [
      {
        code: 'FIRE',
        included: true,
        sumInsured: {
          proposed1: rupees(record.fire.proposed1),
          proposed2: rupees(record.fire.proposed2),
        },
      },
      ...record.sections.map((section) => ({
        code: section.code,
        included: section.included,
        sumInsured: { proposed1: rupees(section.proposed1), proposed2: rupees(section.proposed2) },
      })),
    ],
  };
}
