import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { STAGES, type Stage } from '@/types/proposal';
import {
  parseProposalParams,
  parseStage,
  parseType,
  proposalParamsToSearch,
  toggleStage,
  withType,
} from './proposal-params';

const parse = (query: string) => parseProposalParams(new URLSearchParams(query));

describe('proposal params', () => {
  it('reads type and stage leniently', () => {
    expect(parseType('existing')).toBe('EXISTING');
    expect(parseType('new')).toBe('NEW');
    expect(parseType('EXISTING')).toBe('NEW'); // only exactly "existing"
    expect(parseType(null)).toBe('NEW');
    expect(parseStage('rfq-sent')).toBe('RFQ_SENT');
    expect(parseStage('bogus')).toBeNull();
    expect(parseStage(null)).toBeNull();
  });

  it('writes the default as the empty string', () => {
    expect(proposalParamsToSearch({ type: 'NEW', stage: null })).toBe('');
    expect(proposalParamsToSearch({ type: 'EXISTING', stage: null })).toBe('?type=existing');
    expect(proposalParamsToSearch({ type: 'NEW', stage: 'QCR' })).toBe('?stage=qcr');
    expect(proposalParamsToSearch({ type: 'EXISTING', stage: 'RFQ_SENT' })).toBe(
      '?type=existing&stage=rfq-sent',
    );
  });

  it('clears the stage when the type changes and toggles the stage', () => {
    expect(withType('EXISTING')).toEqual({ type: 'EXISTING', stage: null });
    const base = { type: 'NEW', stage: 'QCR' } as const;
    expect(toggleStage(base, 'QCR')).toEqual({ type: 'NEW', stage: null }); // same again clears
    expect(toggleStage(base, 'DRAFT')).toEqual({ type: 'NEW', stage: 'DRAFT' }); // another selects
    expect(toggleStage({ type: 'NEW', stage: null }, 'PLACED')).toEqual({
      type: 'NEW',
      stage: 'PLACED',
    });
  });

  // Feature: frontend-shell, Property 11: URL state survives a round trip
  it('round-trips any state through the query string', () => {
    const stageArb = fc.option(fc.constantFrom<Stage>(...STAGES), { nil: null });
    fc.assert(
      fc.property(fc.constantFrom('NEW' as const, 'EXISTING' as const), stageArb, (type, stage) => {
        const state = { type, stage };
        expect(parse(proposalParamsToSearch(state))).toEqual(state);
      }),
    );
  });

  // Feature: frontend-shell, Property 11: URL state survives a round trip
  it('parses arbitrary query strings to a valid state', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (type, stage) => {
        const query = new URLSearchParams();
        if (type) query.set('type', type);
        if (stage) query.set('stage', stage);
        const parsed = parse(query.toString());
        expect(parsed.type === 'NEW' || parsed.type === 'EXISTING').toBe(true);
        expect(parsed.stage === null || STAGES.includes(parsed.stage)).toBe(true);
        // The type is EXISTING only for exactly "existing".
        expect(parsed.type === 'EXISTING').toBe(type === 'existing');
      }),
    );
  });
});
