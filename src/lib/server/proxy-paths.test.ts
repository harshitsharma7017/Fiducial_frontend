import { describe, expect, it } from 'vitest';
import { isAllowedProxyPath } from './proxy-paths';

describe('isAllowedProxyPath', () => {
  it.each([
    [['users']],
    [['roles']],
    [['roles', 'GPA_CASE_VIEWER', 'deactivate']],
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
    [['notifications']],
    [['notifications', 'unread-count']],
    [['notifications', '0123456789abcdef01234567', 'read']],
    [['chat', 'events']],
    [['chat', 'conversations', '0123456789abcdef01234567', 'messages']],
    [['proposals', '0123456789abcdef01234567', 'mails']],
    [['qcrs']],
    [['placement-slips']],
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
    [['tpa', '..', 'auth', 'login']],
    [['renewals']],
    // Employee Benefits areas are reached through fiducial-ghi-frontend.
    [['ghi', 'cases']],
    [['claims', 'board']],
    [['eb', 'gpa', 'cases', '0123456789abcdef01234567', 'rfq']],
    [['family-plans']],
    [['age-bands', '0123456789abcdef01234567', 'cases']],
    [['tpa', 'imports', '0123456789abcdef01234567', 'rows']],
    [['claims-analysis']],
    [['renewal', 'analysis', 'document']],
  ])('rejects %j', (segments) => {
    expect(isAllowedProxyPath(segments)).toBe(false);
  });
});
