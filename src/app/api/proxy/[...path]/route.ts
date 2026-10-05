import { NextResponse, type NextRequest } from 'next/server';
import {
  errorResponse,
  forwardingHeaders,
  getApiUrl,
  isSameOrigin,
  upstreamUnavailable,
} from '@/lib/server/bff';
import { isAllowedProxyPath } from '@/lib/server/proxy-paths';
import { SESSION_COOKIE, clearedSessionCookieOptions } from '@/lib/session';
import { ERROR_CODES } from '@/shared';

/**
 * Forwards browser calls to the Express API (/api/proxy/<path> -> /api/v1/<path>), adding the
 * access token from the httpOnly session cookie as a bearer token.
 */

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

const FORWARDED_RESPONSE_HEADERS = [
  'content-type',
  'x-request-id',
  'retry-after',
  'ratelimit',
  'ratelimit-policy',
];

async function forward(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return errorResponse(401, ERROR_CODES.UNAUTHENTICATED, 'Sign in to continue');

  if (request.method !== 'GET' && !isSameOrigin(request)) {
    return errorResponse(403, ERROR_CODES.FORBIDDEN, 'Cross-site requests are not allowed');
  }

  const { path } = await params;
  if (!isAllowedProxyPath(path)) return errorResponse(404, ERROR_CODES.NOT_FOUND, 'Not found');

  const url = new URL(`/api/v1/${path.map(encodeURIComponent).join('/')}`, getApiUrl());
  url.search = request.nextUrl.search;

  const headers = forwardingHeaders(request);
  headers.set('Authorization', `Bearer ${token}`);
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: 'no-store',
      redirect: 'manual',
    });
  } catch {
    return upstreamUnavailable();
  }

  const responseHeaders = new Headers({ 'Cache-Control': 'no-store' });
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  const response = new NextResponse(upstream.status === 204 ? null : upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
  // The API no longer accepts this token (expired, or the user was deactivated): end the session.
  if (upstream.status === 401)
    response.cookies.set(SESSION_COOKIE, '', clearedSessionCookieOptions());
  return response;
}

export { forward as DELETE, forward as GET, forward as PATCH, forward as POST };
