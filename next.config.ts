import type { NextConfig } from 'next';
import { appBaseUrl } from './src/lib/app-links.ts';

// The employee claim link (/claim#t=<token>) moved to fiducial-ghi-frontend. Links made here
// before the move go there; browsers keep the #t= fragment across the redirect. Read at build time.
const ghiAppUrl = appBaseUrl(process.env.NEXT_PUBLIC_GHI_APP_URL);

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  headers() {
    return Promise.resolve([{ source: '/:path*', headers: securityHeaders }]);
  },
  redirects() {
    return Promise.resolve(
      ghiAppUrl ? [{ source: '/claim', destination: `${ghiAppUrl}/claim`, permanent: false }] : [],
    );
  },
};

export default nextConfig;
