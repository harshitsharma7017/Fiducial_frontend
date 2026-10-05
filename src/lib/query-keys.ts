/** TanStack Query keys in one place, so invalidation stays consistent. */
export const queryKeys = {
  me: ['auth', 'me'] as const,
  health: ['health'] as const,
  activeVersions: ['masters', 'versions', 'ACTIVE'] as const,
  occupancies: (q: string) => ['masters', 'occupancies', q] as const,
  occupancy: (tacCode: string) => ['masters', 'occupancy', tacCode] as const,
  pincode: (pincode: string) => ['masters', 'pincode', pincode] as const,
  users: ['users'] as const,
};
