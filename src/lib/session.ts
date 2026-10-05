/**
 * The session cookie holds the API access token. It is httpOnly, so browser JavaScript can
 * never read it; only the Next.js server (route handlers and proxy.ts) sees it.
 */

const isProduction = process.env.NODE_ENV === 'production';

/** In production the __Host- prefix pins the cookie to this host, over HTTPS, at path /. */
export const SESSION_COOKIE = isProduction ? '__Host-erp_session' : 'erp_session';

export interface SessionCookieOptions {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: '/';
  maxAge: number;
}

/** The cookie lives exactly as long as the token, so an expired token is never sent. */
export function sessionCookieOptions(maxAgeSeconds: number): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

/** Options that delete the cookie. */
export function clearedSessionCookieOptions(): SessionCookieOptions {
  return sessionCookieOptions(0);
}
