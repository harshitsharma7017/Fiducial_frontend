'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  IMPORT_SHEETS,
  ImportReportSchema,
  MasterImportResultSchema,
  MasterVersionSchema,
  XLSX_CONTENT_TYPE,
  type ImportEntity,
} from '@/shared';

// The Import data page's requests: records (clients, locations, insurers) and the IIB master.
// Files go as .xlsx whatever the browser calls them; the API checks the content itself.

const asXlsx = (file: File) => new Blob([file], { type: XLSX_CONTENT_TYPE });

interface RecordUpload {
  entity: ImportEntity;
  file: File;
  /** Rows to import; omitted for a preview. */
  rows?: readonly number[];
}

function sendRecords({ entity, file, rows }: RecordUpload) {
  const query = new URLSearchParams({ dryRun: String(rows === undefined) });
  if (rows) query.set('rows', rows.join(','));
  return apiFetch(`imports/${entity}?${query.toString()}`, {
    method: 'POST',
    body: asXlsx(file),
    schema: ImportReportSchema,
  });
}

/** Preview a records file, tick rows, import the ticked valid ones. */
export function useRecordImport() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const preview = useMutation({
    mutationFn: sendRecords,
    onSuccess: (report) => {
      setSelected(new Set(report.rows.filter((row) => row.valid).map((row) => row.row)));
    },
  });
  const importer = useMutation({
    mutationFn: sendRecords,
    onSuccess: (report, { entity, file }) => {
      if (!report.imported) return;
      void queryClient.invalidateQueries({
        queryKey: entity === 'insurers' ? queryKeys.insurers.all : queryKeys.clients.all,
      });
      toast({
        title: `${IMPORT_SHEETS[entity].label} imported`,
        description: `${report.createdCount} saved from ${file.name}.`,
        variant: 'success',
      });
    },
  });
  return {
    preview,
    importer,
    selected,
    setSelected,
    reset() {
      setSelected(new Set());
      preview.reset();
      importer.reset();
    },
  };
}

function sendMaster(file: File, dryRun: boolean) {
  const query = new URLSearchParams({ dryRun: String(dryRun), fileName: file.name });
  return apiFetch(`masters/import?${query.toString()}`, {
    method: 'POST',
    body: asXlsx(file),
    schema: MasterImportResultSchema,
  });
}

/** Preview the IIB master workbook, save it as draft versions, then activate them. */
export function useMasterImport() {
  const queryClient = useQueryClient();
  const preview = useMutation({ mutationFn: (file: File) => sendMaster(file, true) });
  const save = useMutation({
    mutationFn: (file: File) => sendMaster(file, false),
    onSuccess: (result) => {
      if (result.versions.length === 0) return;
      toast({
        title: result.alreadyImported ? 'Already uploaded' : 'Saved as a draft version',
        description: 'Activate it to start using it.',
        variant: 'success',
      });
    },
  });
  const activate = useMutation({
    mutationFn: async (versionIds: string[]) => {
      for (const id of versionIds) {
        await apiFetch(`masters/versions/${id}/activate`, {
          method: 'POST',
          body: {},
          schema: MasterVersionSchema,
        });
      }
    },
    onSuccess: () => {
      // Every occupancy and pincode lookup now reads the new version.
      void queryClient.invalidateQueries({ queryKey: ['masters'] });
      toast({ title: 'IIB master activated', variant: 'success' });
    },
  });
  return {
    preview,
    save,
    activate,
    reset() {
      preview.reset();
      save.reset();
      activate.reset();
    },
  };
}
