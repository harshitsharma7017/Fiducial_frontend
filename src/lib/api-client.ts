import { ApiErrorSchema } from '@property-erp/shared';
import type { z } from 'zod';

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

/** Only same-site paths are followed after sign-in, never another origin. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\'))
    return '/dashboard';
  if (next === '/login' || next.startsWith('/login?')) return '/dashboard';
  return next;
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
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`/api/proxy/${path.replace(/^\/+/, '')}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
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
