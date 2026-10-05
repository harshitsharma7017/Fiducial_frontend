import {
  ApiErrorSchema,
  ERROR_CODES,
  LoginRequestSchema,
  LoginResponseSchema,
  type SessionResponse,
} from '@property-erp/shared';
import { NextResponse, type NextRequest } from 'next/server';
import {
  errorResponse,
  forwardingHeaders,
  getApiUrl,
  isSameOrigin,
  upstreamUnavailable,
} from '@/lib/server/bff';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/session';

/**
 * Signs in against the Express API and stores the access token in an httpOnly cookie.
 * The browser receives the user, never the token.
 */
export async function POST(request: NextRequest): Promise<Response> {
  if (!isSameOrigin(request)) {
    return errorResponse(403, ERROR_CODES.FORBIDDEN, 'Cross-site requests are not allowed');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, ERROR_CODES.INVALID_JSON, 'The request body is not valid JSON');
  }
  const credentials = LoginRequestSchema.safeParse(body);
  if (!credentials.success) {
    return NextResponse.json(
      {
        message: 'Check the highlighted fields',
        code: ERROR_CODES.VALIDATION_ERROR,
        details: credentials.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const headers = forwardingHeaders(request);
  headers.set('Content-Type', 'application/json');
  let upstream: Response;
  try {
    upstream = await fetch(`${getApiUrl()}/api/v1/auth/login`, {
      method: 'POST',
      headers,
      body: JSON.stringify(credentials.data),
      cache: 'no-store',
    });
  } catch {
    return upstreamUnavailable();
  }

  const data: unknown = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    const error = ApiErrorSchema.safeParse(data);
    const response = NextResponse.json(
      error.success
        ? error.data
        : { message: 'Sign-in failed. Try again.', code: ERROR_CODES.INTERNAL_ERROR },
      { status: upstream.status },
    );
    const retryAfter = upstream.headers.get('retry-after');
    if (retryAfter) response.headers.set('Retry-After', retryAfter);
    return response;
  }

  const session = LoginResponseSchema.safeParse(data);
  if (!session.success) return upstreamUnavailable();

  const response = NextResponse.json<SessionResponse>(
    { user: session.data.user },
    { headers: { 'Cache-Control': 'no-store' } },
  );
  response.cookies.set(
    SESSION_COOKIE,
    session.data.accessToken,
    sessionCookieOptions(session.data.expiresIn),
  );
  return response;
}
