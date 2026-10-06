import { STAGE_SLUGS, type ProposalType, type Stage } from '@/types/proposal';

/**
 * The dashboard and proposal lists keep their type and stage filter in the URL (?type=, ?stage=),
 * so a view can be linked and survives a refresh. Parsing is lenient: unknown values fall back.
 */
export interface ProposalParams {
  type: ProposalType;
  stage: Stage | null;
}

const SLUG_TO_STAGE = new Map<string, Stage>(
  Object.entries(STAGE_SLUGS).map(([stage, slug]) => [slug, stage as Stage]),
);

/** The type for a `type` value: EXISTING only for exactly "existing", NEW otherwise. */
export function parseType(value: string | null): ProposalType {
  return value === 'existing' ? 'EXISTING' : 'NEW';
}

/** The stage for a `stage` slug, or null when missing or unknown. */
export function parseStage(value: string | null): Stage | null {
  return value === null ? null : (SLUG_TO_STAGE.get(value) ?? null);
}

export function parseProposalParams(search: URLSearchParams): ProposalParams {
  return { type: parseType(search.get('type')), stage: parseStage(search.get('stage')) };
}

/** The query string for a type and stage; the default (new, no stage) is the empty string. */
export function proposalParamsToSearch({ type, stage }: ProposalParams): string {
  const params = new URLSearchParams();
  if (type === 'EXISTING') params.set('type', 'existing');
  if (stage) params.set('stage', STAGE_SLUGS[stage]);
  const query = params.toString();
  return query ? `?${query}` : '';
}

/** Changing the type clears the stage filter (requirement 9.5). */
export function withType(type: ProposalType): ProposalParams {
  return { type, stage: null };
}

/** Selecting the active stage again clears it; selecting another selects it (requirement 11.3). */
export function toggleStage(current: ProposalParams, stage: Stage): ProposalParams {
  return { type: current.type, stage: current.stage === stage ? null : stage };
}
