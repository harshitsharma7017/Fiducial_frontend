'use client';

import { useState } from 'react';
import { ImportPanel } from '@/components/imports/import-panel';
import { CatalogImportResult } from '@/components/imports/catalog-import-result';
import { MasterImportResultView } from '@/components/imports/master-import-result';
import { RecordImportResult } from '@/components/imports/record-import-result';
import {
  allowedRecordTypes,
  isRecordType,
  type RecordType,
} from '@/components/imports/record-types';
import {
  useCatalogImport,
  useMasterImport,
  useRecordImport,
} from '@/components/imports/use-imports';
import { PageHeader } from '@/components/page-header';
import { ErrorState } from '@/components/states';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useUrlSearchParams } from '@/lib/use-url-search-params';

export function ImportView({ serverSearch = '' }: { serverSearch?: string }) {
  const me = useCurrentUser();
  const { params, replace } = useUrlSearchParams(serverSearch);
  // Each record type needs its own permission (the master and insurers: Admin only).
  const types = me.data ? allowedRecordTypes(me.data.roles) : [];
  const fromUrl = params.get('type');
  const type: RecordType | undefined =
    isRecordType(fromUrl) && types.includes(fromUrl) ? fromUrl : types[0];
  const [file, setFile] = useState<File | null>(null);
  const records = useRecordImport();
  const master = useMasterImport();
  const catalog = useCatalogImport();

  function startOver(nextFile: File | null = null) {
    setFile(nextFile);
    records.reset();
    master.reset();
    catalog.reset();
  }

  if (!type) return <PageHeader title="Import data" />;
  const busy =
    records.preview.isPending ||
    records.importer.isPending ||
    master.preview.isPending ||
    master.save.isPending ||
    master.activate.isPending ||
    catalog.preview.isPending ||
    catalog.save.isPending;
  const failure =
    records.preview.error ??
    records.importer.error ??
    master.preview.error ??
    master.save.error ??
    master.activate.error ??
    catalog.preview.error ??
    catalog.save.error;

  // A refused records import comes back re-checked; show it instead of the earlier preview.
  const refused = records.importer.data && !records.importer.data.imported;
  const masterResult = master.save.data ?? master.preview.data;
  const catalogResult = catalog.save.data ?? catalog.preview.data;

  return (
    <>
      <PageHeader
        title="Import data"
        description="Load the IIB master, the policy and cover masters, clients, risk locations and insurers from Excel. Upload the masters first, and clients before their risk locations."
      />
      <div className="grid gap-4">
        <ImportPanel
          types={types}
          type={type}
          onTypeChange={(next) => {
            replace(`type=${next}`);
            startOver();
          }}
          file={file}
          onFileChange={(next) => startOver(next)}
          onPreview={() => {
            if (!file) return;
            startOver(file);
            if (type === 'masters') master.preview.mutate(file);
            else if (type === 'catalog') catalog.preview.mutate(file);
            else records.preview.mutate({ entity: type, file });
          }}
          previewing={
            records.preview.isPending || master.preview.isPending || catalog.preview.isPending
          }
          busy={busy}
        />

        <div aria-live="polite" className="grid gap-4">
          {failure ? <ErrorState title="That did not work" error={failure} /> : null}
          {type === 'catalog' ? (
            catalogResult ? (
              <CatalogImportResult
                report={catalogResult}
                onSave={() => {
                  if (file) catalog.save.mutate(file);
                }}
                saving={catalog.save.isPending}
              />
            ) : null
          ) : type === 'masters' ? (
            masterResult ? (
              <MasterImportResultView
                result={masterResult}
                onSave={() => {
                  if (file) master.save.mutate(file);
                }}
                saving={master.save.isPending}
                onActivate={(ids) => master.activate.mutate(ids)}
                activating={master.activate.isPending}
                activated={master.activate.isSuccess}
              />
            ) : null
          ) : (
            <RecordImportResult
              entity={type}
              report={refused ? records.importer.data : records.preview.data}
              done={records.importer.data?.imported ? records.importer.data : null}
              selected={records.selected}
              onSelectedChange={records.setSelected}
              onImport={(rows) => {
                if (file) records.importer.mutate({ entity: type, file, rows });
              }}
              importing={records.importer.isPending}
              onStartOver={() => startOver()}
            />
          )}
        </div>
      </div>
    </>
  );
}
