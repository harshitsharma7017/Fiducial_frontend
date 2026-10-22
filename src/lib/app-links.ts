// Links into the other Fiducial frontend. Employee Benefits (GMC, GPA, GTLI) and group health
// claims live in fiducial-ghi-frontend; NEXT_PUBLIC_GHI_APP_URL is its public URL. It is not a
// secret: Next.js inlines it into the browser bundle at build time. Unset, or not an http(s) URL:
// no link.

/** The URL without trailing slashes, or null when it is missing or not http(s). */
export function appBaseUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.href.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

const GHI_APP_URL = appBaseUrl(process.env.NEXT_PUBLIC_GHI_APP_URL);

/** The GHI app's URL for a path such as /ghi/{id}, or null when it is not configured. */
export function ghiAppUrl(path: string): string | null {
  return GHI_APP_URL ? `${GHI_APP_URL}${path}` : null;
}
