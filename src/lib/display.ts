import { RISK_TYPE_LABELS, formatRate, type RiskType } from '@/shared';

/** A per-mille rate for display, or an em dash when the master has no value. */
export function displayRate(value: string | null | undefined): string {
  return value ? formatRate(value) : '—';
}

export function riskTypeLabel(value: RiskType | null): string {
  return value ? RISK_TYPE_LABELS[value] : 'Blank';
}
