import { describe, expect, it } from 'vitest';
import { isAllowedProxyPath } from './proxy-paths';

describe('isAllowedProxyPath', () => {
  it.each([
    [['users']],
    [['masters', 'occupancies']],
    [['clients']],
    [['clients', '0123456789abcdef01234567', 'locations']],
    [['insurers', '0123456789abcdef01234567']],
    [['imports', 'clients', 'template']],
    [['proposals', '0123456789abcdef01234567', 'rfq']],
    [['qcrs']],
    [['health']],
    [['audit']],
    [['email-templates']],
    [['email-templates', 'RFQ']],
    [['mail', 'status']],
    [['proposals', '0123456789abcdef01234567', 'mails']],
    [['qcrs']],
    [['placement-slips']],
    [['ghi', 'cases']],
    [['claims', 'board']],
    [['ghi', 'cases', '0123456789abcdef01234567', 'census', 'imports']],
    [['eb', 'cases']],
    [['eb', 'gpa', 'cases', '0123456789abcdef01234567', 'rfq']],
    [['family-plans']],
    [['family-plans', '0123456789abcdef01234567', 'versions']],
    [['age-bands', '0123456789abcdef01234567', 'cases']],
    [['auth', 'me']],
  ])('allows %j', (segments) => {
    expect(isAllowedProxyPath(segments)).toBe(true);
  });

  it.each([
    [[]],
    [['auth', 'login']],
    [['auth']],
    [['quotes']],
    [['mailer']],
    [['rating', 'fire']],
    [['clients', '..', 'auth', 'login']],
    [['clients', '']],
    [['ghi', '..', 'auth', 'login']],
    [['claim-links', 'current']],
    [['ebx']],
    [['family']],
    [['eb', '..', 'auth', 'login']],
  ])('rejects %j', (segments) => {
    expect(isAllowedProxyPath(segments)).toBe(false);
  });
});
