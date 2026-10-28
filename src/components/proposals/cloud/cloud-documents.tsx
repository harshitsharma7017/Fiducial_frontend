'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CloudUpload, Download, LoaderCircle, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePermission } from '@/hooks/use-permission';
import { toast } from '@/hooks/use-toast';
import { apiDownload, apiFetch, saveFile } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  CLOUD_DOCUMENT_LABELS,
  CloudDocumentListSchema,
  CloudDocumentSchema,
  formatDateTime,
  type CloudDocument,
  type CloudDocumentKind,
} from '@/shared';

// Saved copies of a case's documents. Every file is kept in cloud storage (S3); "Save to cloud"
// keeps a copy of a generated document (the RFQ, QCR or placement slip) as it is now.

/** The case's documents in cloud storage, and whether the server has cloud storage at all. */
export function useCloudDocuments(proposalId: string) {
  return useQuery({
    queryKey: queryKeys.proposals.cloudDocuments(proposalId),
    queryFn: ({ signal }) =>
      apiFetch(`proposals/${proposalId}/cloud-documents`, {
        schema: CloudDocumentListSchema,
        signal,
      }),
  });
}

const FORMATS = [
  { format: 'pdf', label: 'PDF' },
  { format: 'xlsx', label: 'Excel' },
] as const;

/**
 * "Save to cloud" beside a document's downloads: the document as it downloads, as PDF or Excel,
 * put in cloud storage. Shown to users who may download it, when the server has cloud storage.
 */
export function SaveToCloud({
  proposalId,
  document,
  disabled = false,
}: {
  proposalId: string;
  document: CloudDocumentKind;
  disabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const canExport = usePermission('property.export');
  const list = useCloudDocuments(proposalId);
  const save = useMutation({
    mutationFn: (format: 'pdf' | 'xlsx') =>
      apiFetch(`proposals/${proposalId}/cloud-documents`, {
        method: 'POST',
        body: { document, format },
        schema: CloudDocumentSchema,
      }),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.proposals.cloudDocuments(proposalId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.proposals.record(proposalId) });
      toast({
        title: `${CLOUD_DOCUMENT_LABELS[document]} saved to cloud storage`,
        description: saved.fileName,
        variant: 'success',
      });
    },
    onError: (error) =>
      toast({
        title: 'Not saved to cloud storage',
        description: errorMessage(error),
        variant: 'destructive',
      }),
  });
  if (!canExport || !list.data?.enabled) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled || save.isPending}>
          {save.isPending ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <CloudUpload aria-hidden="true" />
          )}
          Save to cloud
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {FORMATS.map(({ format, label }) => (
          <DropdownMenuItem key={format} onSelect={() => save.mutate(format)}>
            {CLOUD_DOCUMENT_LABELS[document]} as {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** The documents of the case saved to cloud storage, to download again or remove. */
export function CloudDocumentsCard({ proposalId }: { proposalId: string }) {
  const queryClient = useQueryClient();
  const list = useCloudDocuments(proposalId);
  const canExport = usePermission('property.export');
  const canEdit = usePermission('property.edit');
  const [removing, setRemoving] = useState<CloudDocument | null>(null);
  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.proposals.cloudDocuments(proposalId),
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.proposals.record(proposalId) });
  };
  const download = useMutation({
    mutationFn: (item: CloudDocument) =>
      apiDownload(`proposals/${proposalId}/cloud-documents/${item.id}/file`, item.fileName),
    onSuccess: (file) => saveFile(file),
    onError: (error) =>
      toast({
        title: 'Could not download',
        description: errorMessage(error),
        variant: 'destructive',
      }),
  });
  const remove = useMutation({
    mutationFn: (item: CloudDocument) =>
      apiFetch(`proposals/${proposalId}/cloud-documents/${item.id}`, { method: 'DELETE' }),
    onSuccess: (_, item) => {
      refresh();
      setRemoving(null);
      toast({
        title: 'Removed from cloud storage',
        description: item.fileName,
        variant: 'success',
      });
    },
    onError: (error) =>
      toast({
        title: 'Could not remove',
        description: errorMessage(error),
        variant: 'destructive',
      }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cloud documents</CardTitle>
        <CardDescription>
          Every file of the case is kept in cloud storage. The RFQ, QCR and placement slip are also
          made fresh on each download; “Save to cloud” (on the RFQ review, QCR and Placement slip
          tabs) keeps a copy of one as it is now.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {list.isPending ? (
          <LoadingState label="Loading cloud documents" />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : !list.data.enabled && list.data.items.length === 0 ? (
          <EmptyState
            title="Cloud storage is not set up"
            description="Ask an Admin to configure the S3 bucket. Until then every document stays in Fiducial only."
          />
        ) : list.data.items.length === 0 ? (
          <EmptyState
            title="Nothing saved to the cloud yet"
            description="Use “Save to cloud” beside a document’s downloads."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Saved</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {CLOUD_DOCUMENT_LABELS[item.document]}
                    {item.detail ? (
                      <span className="text-muted-foreground"> · {item.detail}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-normal">{item.fileName}</TableCell>
                  <TableCell className="text-sm">
                    {formatDateTime(item.savedAt)}
                    <span className="block text-xs text-muted-foreground">by {item.savedBy}</span>
                  </TableCell>
                  <TableCell className="text-right tabular">{size(item.size)}</TableCell>
                  <TableCell>
                    <span className="flex justify-end gap-1">
                      {canExport && list.data.enabled ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={download.isPending}
                          onClick={() => download.mutate(item)}
                        >
                          <Download aria-hidden="true" />
                          Download
                          <span className="sr-only"> {item.fileName}</span>
                        </Button>
                      ) : null}
                      {canEdit && list.data.enabled ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={remove.isPending}
                          onClick={() => setRemoving(item)}
                        >
                          <Trash2 aria-hidden="true" />
                          Remove
                          <span className="sr-only"> {item.fileName}</span>
                        </Button>
                      ) : null}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove from cloud storage?</DialogTitle>
              <DialogDescription>
                The cloud copy of {removing?.fileName} is deleted. The case and its documents in
                Fiducial are not changed.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRemoving(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={remove.isPending}
                onClick={() => removing && remove.mutate(removing)}
              >
                {remove.isPending ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 aria-hidden="true" />
                )}
                Remove
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
