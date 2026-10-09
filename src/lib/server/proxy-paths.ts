// Only these API areas are reachable through /api/proxy. Sign-in is not: it returns a token,
// and the token must never reach the browser (see /api/auth/login). The API checks each user's
// permission for every area (audit, for example, is Admin only).
const ALLOWED_AREAS = new Set([
  'users',
  'masters',
  'clients',
  'insurers',
  'imports',
  'catalog',
  'templates',
  'email-templates',
  'mail',
  'proposals',
  // The lists across cases for the Quotes and QCR and Placement Slips pages.
  'qcrs',
  'placement-slips',
  'health',
  'audit',
]);

/** True when the proxied path is one the browser may call. */
export function isAllowedProxyPath(segments: string[]): boolean {
  if (segments.length === 0) return false;
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..'))
    return false;
  const [area, next] = segments;
  if (area === 'auth') return segments.length === 2 && next === 'me';
  return area !== undefined && ALLOWED_AREAS.has(area);
}
