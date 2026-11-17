'use client';

import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { PageHeader } from '@/components/page-header';
import { EmptyState, ErrorState, TableLoadingRows } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePermission } from '@/hooks/use-permission';
import { wcCasesQuery } from '@/lib/wc/api';
import { WcStageBadge } from '@/components/wc/wc-ui';
import { WC_TYPE_LABELS } from '@/shared';

/** The workmen compensation cases, most recently changed first. */
export function WcListView() {
  const canCreate = usePermission('wc.create');
  return (
    <>
      <PageHeader
        title="WC (Workmen Compensation)"
        description="Workmen compensation cases: the Data Sheet with its worker categories, the RFQ to insurers and the quote comparison."
        actions={
          canCreate ? (
            <Button asChild>
              <Link href="/wc/new">
                <Plus aria-hidden="true" />
                New case
              </Link>
            </Button>
          ) : null
        }
      />
      <DemoModeGate>
        <CaseList />
      </DemoModeGate>
    </>
  );
}

function CaseList() {
  const cases = useQuery(wcCasesQuery());
  return (
    <Card>
      <CardContent className="pt-6">
        {cases.isError ? (
          <ErrorState error={cases.error} onRetry={() => void cases.refetch()} />
        ) : (
          <div
            role="region"
            aria-label="Workmen compensation cases"
            tabIndex={0}
            className="overflow-x-auto rounded-md border"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Persons</TableHead>
                  <TableHead className="text-right">Insurers quoted</TableHead>
                  <TableHead>Stage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.isPending ? (
                  <TableLoadingRows columns={6} />
                ) : cases.data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <EmptyState title="No WC case" description="Start one with New case." />
                    </TableCell>
                  </TableRow>
                ) : (
                  cases.data.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Link
                          className="font-medium text-accent-strong hover:underline"
                          href={`/wc/${item.id}`}
                        >
                          {item.reference}
                        </Link>
                      </TableCell>
                      <TableCell>{item.clientName}</TableCell>
                      <TableCell>{WC_TYPE_LABELS[item.type]}</TableCell>
                      <TableCell className="text-right tabular">{item.persons}</TableCell>
                      <TableCell className="text-right tabular">{item.insurers}</TableCell>
                      <TableCell>
                        <WcStageBadge stage={item.stage} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
