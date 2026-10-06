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
    [['rating', 'fire']],
    [['health']],
    [['audit']],
    [['auth', 'me']],
  ])('allows %j', (segments) => {
    expect(isAllowedProxyPath(segments)).toBe(true);
  });

  it.each([
    [[]],
    [['auth', 'login']],
    [['auth']],
    [['proposals']],
    [['clients', '..', 'auth', 'login']],
    [['clients', '']],
  ])('rejects %j', (segments) => {
    expect(isAllowedProxyPath(segments)).toBe(false);
  });
});
