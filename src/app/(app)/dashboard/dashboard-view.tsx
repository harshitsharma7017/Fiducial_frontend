'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, CircleCheck, Database, TriangleAlert, UserCog } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { ErrorState, LoadingState, MasterNotActiveState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUser } from '@/hooks/use-current-user';
import { ApiError, apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  HealthResponseSchema,
  MasterVersionListResponseSchema,
  ROLE_LABELS,
  formatDate,
  formatDateTime,
  formatIndianNumber,
  type MasterVersion,
} from '@/shared';

const MASTER_TITLES: Record<MasterVersion['type'], string> = {
  OCCUPANCY: 'Occupancy (IIB codes)',
  PINCODE: 'Pincodes',
};

function HealthCard() {
  const health = useQuery({
    queryKey: queryKeys.health,
    queryFn: ({ signal }) => apiFetch('health', { schema: HealthResponseSchema, signal }),
    refetchInterval: 60_000,
  });
  const databaseDown = health.error instanceof ApiError && health.error.status === 503;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-4 text-accent" aria-hidden="true" />
          System status
        </CardTitle>
        <CardDescription>API and database health</CardDescription>
      </CardHeader>
      <CardContent>
        {health.isPending ? (
          <LoadingState label="Checking system status…" />
        ) : databaseDown ? (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <TriangleAlert className="size-4" aria-hidden="true" />
            The API is up but cannot reach the database.
          </p>
        ) : health.isError ? (
          <ErrorState
            error={health.error}
            onRetry={() => void health.refetch()}
            title="Status unavailable"
          />
        ) : (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">API</dt>
            <dd>
              <Badge variant="success">
                <CircleCheck aria-hidden="true" className="size-3" />
                Up · v{health.data.version}
              </Badge>
            </dd>
            <dt className="text-muted-foreground">Database</dt>
            <dd>
              <Badge variant={health.data.db === 'up' ? 'success' : 'destructive'}>
                {health.data.db === 'up' ? 'Connected' : 'Down'}
              </Badge>
            </dd>
            <dt className="text-muted-foreground">Checked</dt>
            <dd className="tabular">{formatDateTime(health.data.time)}</dd>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function UserCard() {
  const me = useCurrentUser();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCog className="size-4 text-accent" aria-hidden="true" />
          Signed in as
        </CardTitle>
        <CardDescription>Your account and roles</CardDescription>
      </CardHeader>
      <CardContent>
        {me.data ? (
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="sr-only">Name</dt>
              <dd className="font-medium">{me.data.name}</dd>
              <dt className="sr-only">Email</dt>
              <dd className="text-muted-foreground">{me.data.email}</dd>
            </div>
            <div>
              <dt className="mb-1 text-muted-foreground">Roles</dt>
              <dd className="flex flex-wrap gap-1">
                {me.data.roles.map((role) => (
                  <Badge key={role}>{ROLE_LABELS[role]}</Badge>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last sign-in</dt>
              <dd className="tabular">
                {me.data.lastLoginAt ? formatDateTime(me.data.lastLoginAt) : 'First sign-in'}
              </dd>
            </div>
          </dl>
        ) : (
          <LoadingState />
        )}
      </CardContent>
    </Card>
  );
}

function MasterVersionSummary({ version }: { version: MasterVersion }) {
  return (
    <div className="grid gap-1 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{MASTER_TITLES[version.type]}</p>
        <Badge variant="success">Active</Badge>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Records</dt>
        <dd className="tabular">{formatIndianNumber(String(version.stats.recordsImported), 0)}</dd>
        <dt className="text-muted-foreground">Source</dt>
        <dd className="break-all">{version.sourceFileName}</dd>
        <dt className="text-muted-foreground">Effective from</dt>
        <dd className="tabular">
          {version.effectiveFrom ? formatDate(version.effectiveFrom) : '—'}
        </dd>
        <dt className="text-muted-foreground">Import warnings</dt>
        <dd className="tabular">{version.stats.warningCount}</dd>
      </dl>
    </div>
  );
}

function MastersCard() {
  const versions = useQuery({
    queryKey: queryKeys.activeVersions,
    queryFn: ({ signal }) =>
      apiFetch('masters/versions?status=ACTIVE', {
        schema: MasterVersionListResponseSchema,
        signal,
      }),
  });
  return (
    <Card className="md:col-span-2 xl:col-span-1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="size-4 text-accent" aria-hidden="true" />
          Master data
        </CardTitle>
        <CardDescription>The versions every lookup and rating uses</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {versions.isPending ? (
          <LoadingState label="Loading master versions…" />
        ) : versions.isError ? (
          <ErrorState error={versions.error} onRetry={() => void versions.refetch()} />
        ) : versions.data.items.length === 0 ? (
          <MasterNotActiveState />
        ) : (
          versions.data.items.map((version) => (
            <MasterVersionSummary key={version.id} version={version} />
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardView() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="System status, your account and the active master data."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <HealthCard />
        <UserCard />
        <MastersCard />
      </div>
    </>
  );
}
