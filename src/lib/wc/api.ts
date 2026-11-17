import { queryOptions } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { WcCaseListSchema, WcCaseSchema } from '@/shared';

/** TanStack Query keys of the workmen compensation screens. */
export const wcKeys = {
  all: ['wc'] as const,
  list: () => ['wc', 'list'] as const,
  case: (id: string) => ['wc', 'case', id] as const,
};

export const wcCasesQuery = () =>
  queryOptions({
    queryKey: wcKeys.list(),
    queryFn: ({ signal }) => apiFetch('wc/cases', { schema: WcCaseListSchema, signal }),
  });

export const wcCaseQuery = (id: string) =>
  queryOptions({
    queryKey: wcKeys.case(id),
    queryFn: ({ signal }) => apiFetch(`wc/cases/${id}`, { schema: WcCaseSchema, signal }),
  });

/** A new row id for a list being edited (categories, coverage options). */
export function newRowId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
