import type { z } from 'zod';
import { ApiErrorSchema } from '@/shared';

/** An API error with the server's code and details, for display. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** A real origin is never used; the parser just resolves `next` as the browser would. */
const NEXT_BASE_ORIGIN = 'https://app.invalid';
// C0 controls, DEL and C1 controls. A browser strips tab, CR and LF from a URL, so
// "/\t/evil.example" would resolve to another origin after sign-in. Detecting them is the point.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;

/**
 * The path to open after sign-in: `next` only when it stays on this site and is not the sign-in
 * page, otherwise /dashboard. Rejects other origins, protocol-relative ("//host") and
 * backslash or control-character tricks, then returns the resolved path, search and hash.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/dashboard';
  if (next.includes('\\') || CONTROL_CHARACTERS.test(next)) return '/dashboard';

  let url: URL;
  try {
    url = new URL(next, NEXT_BASE_ORIGIN);
  } catch {
    return '/dashboard';
  }
  if (url.origin !== NEXT_BASE_ORIGIN) return '/dashboard';
  if (url.pathname === '/login') return '/dashboard';
  return `${url.pathname}${url.search}${url.hash}`;
}

export function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  const { pathname, search } = window.location;
  if (pathname === '/login') return;
  // A full page load on purpose: the session has ended, so in-memory state is discarded too.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/login?next=${encodeURIComponent(`${pathname}${search}`)}`);
}

export interface ApiRequestOptions<T> {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** Sent as JSON, or as-is with its own content type when it is a Blob (a File upload). */
  body?: unknown;
  /** Validates the response against the shared contract. */
  schema?: z.ZodType<T>;
  signal?: AbortSignal;
}

function toApiError(status: number, data: unknown): ApiError {
  const parsed = ApiErrorSchema.safeParse(data);
  if (parsed.success)
    return new ApiError(status, parsed.data.code, parsed.data.message, parsed.data.details);
  return new ApiError(status, 'UNKNOWN_ERROR', `The request failed (${status}). Try again.`);
}

/**
 * Calls the API through the web app's proxy. The session cookie travels automatically; the
 * browser never handles the token. Any 401 sends the user to the sign-in page.
 */
export async function apiFetch<T>(path: string, options: ApiRequestOptions<T> = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const file = options.body instanceof Blob ? options.body : null;
  if (file) headers['Content-Type'] = file.type || 'application/octet-stream';
  else if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`/api/proxy/${path.replace(/^\/+/, '')}`, {
      method: options.method ?? 'GET',
      headers,
      body: file ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
      credentials: 'same-origin',
      cache: 'no-store',
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Cannot reach the server. Check your connection and try again.',
    );
  }

  if (response.status === 401) {
    redirectToLogin();
    throw new ApiError(401, 'UNAUTHENTICATED', 'Your session has ended. Sign in again.');
  }
  if (response.status === 204) return undefined as T;

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw toApiError(response.status, data);
  return options.schema ? options.schema.parse(data) : (data as T);
}
