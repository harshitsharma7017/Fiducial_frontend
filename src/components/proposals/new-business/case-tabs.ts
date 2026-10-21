import type { ProposalStage } from '@/shared';

// The case's tabs and its stages kept in step: every stage after the Data Sheet is reached by the
// work done on one tab (the RFQ sent, a quote recorded, the QCR approved...), so the stepper,
// the tabs and the next step all read from the stage.

export const CASE_TABS = [
  'data-sheet',
  'review',
  'rfq',
  'quotes',
  'qcr',
  'client-approval',
  'placement-slip',
  'coverage-confirmation',
  'activity',
] as const;
export type CaseTab = (typeof CASE_TABS)[number];

export const CASE_TAB_LABELS: Record<CaseTab, string> = {
  'data-sheet': 'Data Sheet',
  review: 'RFQ review',
  rfq: 'Insurers and RFQ',
  quotes: 'Quotes',
  qcr: 'QCR',
  'client-approval': 'Client approval',
  'placement-slip': 'Placement slip',
  'coverage-confirmation': 'Coverage confirmation',
  activity: 'Activity',
};

/** The stage a tab's work completes: the tab is done once the case is at or past it. */
export const TAB_COMPLETES: Partial<Record<CaseTab, ProposalStage>> = {
  'data-sheet': 'DATA_SHEET',
  review: 'RFQ_SENT',
  rfq: 'RFQ_SENT',
  quotes: 'QUOTES_RECEIVED',
  qcr: 'QCR',
  'client-approval': 'CLIENT_APPROVAL',
  'placement-slip': 'PLACED',
};

/** Where a stage's work is recorded: a step of the stepper opens this tab. */
export const STAGE_TAB: Record<ProposalStage, CaseTab> = {
  DRAFT: 'data-sheet',
  DATA_SHEET: 'data-sheet',
  RFQ_SENT: 'rfq',
  QUOTES_RECEIVED: 'quotes',
  QCR: 'qcr',
  CLIENT_APPROVAL: 'client-approval',
  PLACEMENT_SLIP: 'placement-slip',
  PLACED: 'placement-slip',
  CLOSED: 'activity',
};

/** Where the work of a case at this stage goes on next: the tab a case opens on. */
export const NEXT_WORK_TAB: Record<ProposalStage, CaseTab> = {
  DRAFT: 'data-sheet',
  DATA_SHEET: 'rfq',
  RFQ_SENT: 'quotes',
  QUOTES_RECEIVED: 'qcr',
  QCR: 'client-approval',
  CLIENT_APPROVAL: 'placement-slip',
  PLACEMENT_SLIP: 'placement-slip',
  PLACED: 'placement-slip',
  CLOSED: 'activity',
};

/**
 * What moves a case to its next stage, by that stage. Before RFQ Sent, the Data Sheet and the RFQ
 * say what is missing.
 */
export const NEXT_STEP: Partial<Record<ProposalStage, string>> = {
  QUOTES_RECEIVED: 'Next: record the insurers’ quotes.',
  QCR: 'Next: prepare the QCR and get it approved.',
  CLIENT_APPROVAL: 'Next: record the quote the client accepted.',
  PLACEMENT_SLIP: 'Next: approve the placement slip and send it to the insurer.',
  PLACED: 'Next: record the policy or cover note.',
};
