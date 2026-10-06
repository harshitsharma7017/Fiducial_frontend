'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/states';
import { FilePlus2 } from 'lucide-react';
import { parseType } from '@/lib/proposal-params';
import { useUrlSearchParams } from '@/lib/use-url-search-params';

/** Placeholder for proposal creation (out of scope for the shell), marked Planned. */
export function NewProposalView({ serverSearch }: { serverSearch: string }) {
  const { params } = useUrlSearchParams(serverSearch);
  const type = parseType(params.get('type'));
  const isRenewal = type === 'EXISTING';
  const listHref = `/proposals?type=${isRenewal ? 'existing' : 'new'}`;

  return (
    <>
      <PageHeader
        title={isRenewal ? 'Start renewal' : 'New proposal'}
        description={<Badge variant="muted">Planned</Badge>}
      />
      <EmptyState
        icon={<FilePlus2 className="size-8" />}
        title="Proposal creation is planned"
        description={
          isRenewal
            ? 'Starting a renewal from the app is not available yet. For now, open an existing proposal to review it.'
            : 'Creating a proposal from the app is not available yet. For now, browse the sample proposals.'
        }
        className="mx-auto max-w-md"
      />
      <div className="mt-4 flex justify-center">
        <Button asChild variant="outline">
          <Link href={listHref}>Back to {isRenewal ? 'existing proposals' : 'new proposals'}</Link>
        </Button>
      </div>
    </>
  );
}
