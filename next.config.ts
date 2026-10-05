import path from 'node:path';
import type { NextConfig } from 'next';

// npm runs workspace scripts from apps/web, so the monorepo root is two levels up.
const monorepoRoot = path.resolve(process.cwd(), '../..');

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The shared package ships TypeScript source.
  transpilePackages: ['@property-erp/shared'],
  outputFileTracingRoot: monorepoRoot,
  turbopack: { root: monorepoRoot },
  headers() {
    return Promise.resolve([{ source: '/:path*', headers: securityHeaders }]);
  },
};

export default nextConfig;
