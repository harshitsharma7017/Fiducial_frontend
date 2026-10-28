// Only these API areas are reachable through /api/proxy: the ones this Property, Fire and
// Burglary app calls. Employee Benefits areas (ghi, eb, family plans, age bands, claims, TPA and
// the analyses) are reached through fiducial-ghi-frontend. Sign-in is not reachable: it returns a
// token, and the token must never reach the browser (see /api/auth/login). The API checks each
// user's permission for every area (audit, for example, is Admin only).
const ALLOWED_AREAS = new Set([
  'users',
  // Database-driven roles: the roles page and the user form's role selector.
  'roles',
  'masters',
  'clients',
  'insurers',
  'imports',
  'catalog',
  'templates',
  'email-templates',
  'mail',
  // The signed-in user's in-app notifications (A4).
  'notifications',
  // The internal chat: conversations, messages, files and the live connection (events).
  'chat',
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
