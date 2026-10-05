import { UserSchema } from '@property-erp/shared';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, safeNextPath } from './api-client';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('apiFetch', () => {
  it('calls the proxy and validates the response', async () => {
    const user = {
      id: '0123456789abcdef01234567',
      email: 'a@example.com',
      name: 'A',
      roles: ['ADMIN'],
      active: true,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: '2026-10-05T00:00:00.000Z',
      updatedAt: '2026-10-05T00:00:00.000Z',
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, user));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('auth/me', { schema: UserSchema })).resolves.toEqual(user);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/proxy/auth/me',
      expect.objectContaining({ credentials: 'same-origin' }),
    );
  });

  it('redirects to the sign-in page on any 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(401, { message: 'x', code: 'UNAUTHENTICATED' })),
    );
    const assign = vi.fn();
    vi.stubGlobal('location', {
      ...window.location,
      pathname: '/masters/occupancy',
      search: '?q=2001',
      assign,
    });

    await expect(apiFetch('masters/occupancies')).rejects.toMatchObject({ status: 401 });
    expect(assign).toHaveBeenCalledWith(
      `/login?next=${encodeURIComponent('/masters/occupancy?q=2001')}`,
    );
  });

  it('turns API errors into ApiError with the server code and message', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(422, { message: 'No Fire risk type', code: 'MASTER_DATA_ERROR' }),
        ),
    );
    const error: unknown = await apiFetch('rating/fire', { method: 'POST', body: {} }).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      code: 'MASTER_DATA_ERROR',
      message: 'No Fire risk type',
    });
  });
});

describe('safeNextPath', () => {
  it('only follows same-site paths', () => {
    expect(safeNextPath('/rating/fire')).toBe('/rating/fire');
    expect(safeNextPath('https://evil.example')).toBe('/dashboard');
    expect(safeNextPath('//evil.example')).toBe('/dashboard');
    expect(safeNextPath('/\\evil.example')).toBe('/dashboard');
    expect(safeNextPath('/login')).toBe('/dashboard');
    expect(safeNextPath(undefined)).toBe('/dashboard');
  });
});
