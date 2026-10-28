'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CircleAlert,
  CircleCheck,
  Download,
  FilePlus2,
  FileText,
  LoaderCircle,
  Send,
  ShieldCheck,
  Undo2,
} from 'lucide-react';
import { useId, useState } from 'react';
import { SaveToCloud } from '@/components/proposals/cloud/cloud-documents';
import { ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { usePermission } from '@/hooks/use-permission';
import { ApiError, apiDownload, apiFetch, saveFile } from '@/lib/api-client';
import { clientQuery } from '@/lib/client-query';
import { queryKeys } from '@/lib/query-keys';
import {
  RFQ_VERSION_STATUS_LABELS,
  RfqStateSchema,
  RfqVersionSchema,
  formatDateTime,
  type ProposalRecord,
  type RfqEdits,
  type RfqState,
  type RfqVersionStatus,
} from '@/shared';
import { RfqPreview } from './rfq-preview';

// The RFQ review tab (R-1, R-2, R-5): the RFQ previewed from the case with its own fields edited
// in place, each generation kept as v1, v2, v3, and the approval that has to come before sending.

const STATUS_VARIANT: Record<RfqVersionStatus, 'muted' | 'info' | 'success' | 'warning'> = {
  DRAFT: 'muted',
  SUBMITTED: 'info',
  APPROVED: 'success',
  RETURNED: 'warning',
};

export function rfqStateQuery(id: string) {
  return {
    queryKey: queryKeys.proposals.rfq(id),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiFetch(`proposals/${id}/rfq/versions`, { schema: RfqStateSchema, signal }),
  };
}

const sameEdits = (a: RfqEdits, b: RfqEdits) => JSON.stringify(a) === JSON.stringify(b);

export function RfqReviewPanel({ record }: { record: ProposalRecord }) {
  const open = record.stage !== 'CLOSED';
  const canEdit = usePermission('property.edit') && open;
  const canApprove = usePermission('property.approve') && open;
  const queryClient = useQueryClient();
  const state = useQuery(rfqStateQuery(record.id));
  const client = useQuery(clientQuery(record.client.id));
  const [viewing, setViewing] = useState<number | 'draft'>('draft');
  const [edits, setEdits] = useState<RfqEdits | null>(null);
  const viewId = useId();

  const version = useQuery({
    queryKey: [...queryKeys.proposals.rfq(record.id), 'version', viewing],
    queryFn: ({ signal }) =>
      apiFetch(`proposals/${record.id}/rfq/versions/${String(viewing)}`, {
        schema: RfqVersionSchema,
        signal,
      }),
    enabled: viewing !== 'draft',
  });

  const setState = (next: RfqState) => {
    queryClient.setQueryData(queryKeys.proposals.rfq(record.id), next);
    void queryClient.invalidateQueries({ queryKey: queryKeys.proposals.record(record.id) });
  };
  const saveEdits = useMutation({
    mutationFn: (body: RfqEdits) =>
      apiFetch(`proposals/${record.id}/rfq/edits`, { method: 'PUT', body, schema: RfqStateSchema }),
    onSuccess: (next) => {
      setState(next);
      setEdits(next.edits);
      toast({
        title: 'RFQ edits saved',
        description: 'Generate a new version to include them.',
        variant: 'success',
      });
    },
  });
  const generate = useMutation({
    mutationFn: () =>
      apiFetch(`proposals/${record.id}/rfq/versions`, { method: 'POST', schema: RfqStateSchema }),
    onSuccess: (next) => {
      setState(next);
      setViewing(next.current?.version ?? 'draft');
      toast({ title: `RFQ v${next.current?.version ?? ''} generated`, variant: 'success' });
    },
  });

  if (state.isPending) return <LoadingState label="Loading the RFQ…" />;
  if (state.isError) return <ErrorState error={state.error} onRetry={() => void state.refetch()} />;
  const data = state.data;
  const current = data.current;
  const draftEdits = edits ?? data.edits;
  const dirty = !sameEdits(draftEdits, data.edits);
  const incomplete = record.missing.length > 0;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle className="flex flex-wrap items-center gap-2">
              RFQ {current ? `v${current.version}` : ''}
              {current ? (
                <Badge variant={STATUS_VARIANT[current.status]}>
                  {RFQ_VERSION_STATUS_LABELS[current.status]}
                </Badge>
              ) : null}
              {current?.stale ? <Badge variant="warning">Out of date</Badge> : null}
            </CardTitle>
            <CardDescription>
              Generated from the case: every figure and detail comes from the Data Sheet. Each
              generation is kept as a new version; only an approved, current version is sent to
              insurers.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <Button
                type="button"
                variant={current && !current.stale ? 'outline' : 'default'}
                disabled={incomplete || dirty || generate.isPending}
                onClick={() => generate.mutate()}
              >
                {generate.isPending ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <FilePlus2 aria-hidden="true" />
                )}
                Generate v{(current?.version ?? 0) + 1}
              </Button>
            ) : null}
            {current && canEdit && current.status === 'DRAFT' && !current.stale ? (
              <StepDialog
                record={record}
                version={current.version}
                step="submit"
                onDone={setState}
              />
            ) : null}
            {current && canApprove && current.status === 'SUBMITTED' && !current.stale ? (
              <>
                <StepDialog
                  record={record}
                  version={current.version}
                  step="approve"
                  onDone={setState}
                />
                <StepDialog
                  record={record}
                  version={current.version}
                  step="return"
                  onDone={setState}
                />
              </>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          {incomplete ? (
            <Alert variant="warning">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>The Data Sheet is not complete</AlertTitle>
              <AlertDescription>Finish it before generating the RFQ.</AlertDescription>
            </Alert>
          ) : data.sendable ? (
            <p className="flex items-center gap-1.5 text-sm">
              <CircleCheck aria-hidden="true" className="size-4 text-success" />
              RFQ v{current?.version} is approved: it can be sent to insurers on the Insurers and
              RFQ tab.
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CircleAlert aria-hidden="true" className="size-4 text-warning" />
              {data.blocked}
            </p>
          )}
          {generate.isError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{errorMessage(generate.error)}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby={viewId} className="grid min-w-0 content-start gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="grid gap-1">
              <Label id={viewId} htmlFor={`${viewId}-select`}>
                Preview
              </Label>
              <NativeSelect
                id={`${viewId}-select`}
                className="min-w-64"
                value={String(viewing)}
                onChange={(event) =>
                  setViewing(event.target.value === 'draft' ? 'draft' : Number(event.target.value))
                }
              >
                <option value="draft">The RFQ now, with edits{canEdit ? ' (editable)' : ''}</option>
                {data.versions.map((item) => (
                  <option key={item.version} value={item.version}>
                    v{item.version} — {RFQ_VERSION_STATUS_LABELS[item.status]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            {viewing !== 'draft' ? (
              <Downloads
                record={record}
                version={viewing}
                latest={viewing === Math.max(...data.versions.map((item) => item.version))}
              />
            ) : null}
          </div>
          {viewing === 'draft' && canEdit ? (
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card/95 p-2 shadow-sm backdrop-blur">
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {dirty
                  ? 'Unsaved edits'
                  : data.editsUpdatedAt
                    ? `Edits saved by ${data.editsUpdatedBy ?? 'unknown'}, ${formatDateTime(data.editsUpdatedAt)}`
                    : 'The heading, notes, risk details and claims can be edited here; the rest comes from the Data Sheet.'}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!dirty || saveEdits.isPending}
                  onClick={() => setEdits(null)}
                >
                  Discard edits
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!dirty || saveEdits.isPending}
                  onClick={() => saveEdits.mutate(draftEdits)}
                >
                  {saveEdits.isPending ? (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  ) : null}
                  Save edits
                </Button>
              </div>
            </div>
          ) : null}
          {saveEdits.isError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>
                {errorMessage(saveEdits.error)}
                {saveEdits.error instanceof ApiError && Array.isArray(saveEdits.error.details) ? (
                  <ul className="list-disc pl-4">
                    {(saveEdits.error.details as { message?: string }[]).map((detail, index) => (
                      <li key={index}>{detail.message}</li>
                    ))}
                  </ul>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
          {viewing === 'draft' ? (
            <RfqPreview
              record={record}
              edits={draftEdits}
              client={client.data}
              editing={canEdit ? { edits: draftEdits, onChange: setEdits } : undefined}
            />
          ) : version.isPending ? (
            <LoadingState label="Loading the version…" />
          ) : version.isError ? (
            <ErrorState error={version.error} onRetry={() => void version.refetch()} />
          ) : (
            <RfqPreview
              record={version.data.record}
              edits={version.data.edits}
              client={client.data}
            />
          )}
        </section>

        <aside aria-label="Version history" className="grid content-start gap-3">
          <h3 className="text-sm font-semibold">Version history</h3>
          {data.versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No version yet. Generate v1 when the RFQ is ready.
            </p>
          ) : (
            <ol className="grid gap-3">
              {data.versions.map((item) => (
                <li key={item.version} className="grid gap-1.5 rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 font-semibold"
                      onClick={() => setViewing(item.version)}
                    >
                      v{item.version}
                    </Button>
                    <Badge variant={STATUS_VARIANT[item.status]}>
                      {RFQ_VERSION_STATUS_LABELS[item.status]}
                    </Badge>
                  </div>
                  <ul className="grid gap-1 text-xs text-muted-foreground">
                    {item.events.map((event, index) => (
                      <li key={index}>
                        <span className="text-foreground">
                          {event.action === 'GENERATED'
                            ? 'Generated'
                            : event.action === 'SUBMITTED'
                              ? 'Submitted'
                              : event.action === 'APPROVED'
                                ? 'Approved'
                                : 'Returned'}
                        </span>{' '}
                        by {event.by}, {formatDateTime(event.at)}
                        {event.comment ? (
                          <span className="block text-foreground">“{event.comment}”</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </div>
  );
}

/** A version's files; the latest version can also be saved to cloud storage. */
function Downloads({
  record,
  version,
  latest,
}: {
  record: ProposalRecord;
  version: number;
  latest: boolean;
}) {
  const download = useMutation({
    mutationFn: (format: 'xlsx' | 'pdf') =>
      apiDownload(
        `proposals/${record.id}/rfq/versions/${version}/file?format=${format}`,
        `RFQ-${record.reference}-v${version}.${format}`,
      ),
    onSuccess: (file) => saveFile(file),
  });
  return (
    <div className="flex flex-wrap gap-2">
      {(['xlsx', 'pdf'] as const).map((format) => (
        <Button
          key={format}
          type="button"
          variant="outline"
          size="sm"
          disabled={download.isPending}
          onClick={() => download.mutate(format)}
        >
          {format === 'pdf' ? <FileText aria-hidden="true" /> : <Download aria-hidden="true" />}v
          {version} {format === 'pdf' ? 'PDF' : 'Excel'}
        </Button>
      ))}
      {latest ? <SaveToCloud proposalId={record.id} document="RFQ" /> : null}
      {download.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(download.error)}
        </p>
      ) : null}
    </div>
  );
}

const STEP_TEXT = {
  submit: {
    label: 'Submit for approval',
    title: 'Submit the RFQ for approval',
    done: 'submitted',
    icon: Send,
    required: false,
  },
  approve: {
    label: 'Approve',
    title: 'Approve the RFQ',
    done: 'approved',
    icon: ShieldCheck,
    required: false,
  },
  return: {
    label: 'Return',
    title: 'Return the RFQ with comments',
    done: 'returned',
    icon: Undo2,
    required: true,
  },
} as const;

/** Submit, approve or return the latest version, with a comment (required to return). */
function StepDialog({
  record,
  version,
  step,
  onDone,
}: {
  record: ProposalRecord;
  version: number;
  step: keyof typeof STEP_TEXT;
  onDone: (state: RfqState) => void;
}) {
  const text = STEP_TEXT[step];
  const Icon = text.icon;
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState('');
  const commentId = useId();
  const move = useMutation({
    mutationFn: () =>
      apiFetch(`proposals/${record.id}/rfq/versions/${version}/${step}`, {
        method: 'POST',
        body: { comment },
        schema: RfqStateSchema,
      }),
    onSuccess: (next) => {
      onDone(next);
      setOpen(false);
      toast({ title: `RFQ v${version} ${text.done}`, variant: 'success' });
    },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setComment('');
          move.reset();
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant={step === 'return' ? 'outline' : 'default'}>
          <Icon aria-hidden="true" />
          {text.label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {text.title} (v{version})
          </DialogTitle>
          <DialogDescription>
            {step === 'return'
              ? 'Say what needs changing. The RFQ is then edited and generated again as a new version.'
              : step === 'approve'
                ? 'Once approved, this version can be sent to insurers.'
                : 'An approver then approves it or returns it with comments.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor={commentId}>{text.required ? 'Comments' : 'Comment (optional)'}</Label>
          <Textarea
            id={commentId}
            rows={3}
            maxLength={1000}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
        </div>
        {move.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(move.error)}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={(text.required && !comment.trim()) || move.isPending}
            onClick={() => move.mutate()}
          >
            {move.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            {text.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
