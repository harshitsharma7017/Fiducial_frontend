'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { usePermission } from '@/hooks/use-permission';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  DEFAULT_DOCUMENT_BRAND,
  DocumentBrandInputSchema,
  DocumentBrandSchema,
  MAX_BRAND_ADDRESS_LINES,
  type DocumentBrandInput,
} from '@/shared';

/** The form's values: the address as one line per row of the text box. */
interface Draft {
  companyName: string;
  address: string;
  telephone: string;
  email: string;
  website: string;
  footerNote: string;
}

const draftOf = (brand: DocumentBrandInput): Draft => ({
  companyName: brand.companyName,
  address: brand.addressLines.join('\n'),
  telephone: brand.telephone,
  email: brand.email,
  website: brand.website,
  footerNote: brand.footerNote,
});

const inputOf = (draft: Draft) => ({
  companyName: draft.companyName,
  addressLines: draft.address
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean),
  telephone: draft.telephone,
  email: draft.email,
  website: draft.website,
  footerNote: draft.footerNote,
});

/**
 * The header and footer of every generated PDF (RFQ, QCR, placement slip, the group health and
 * GPA/GTLI documents, the coverage confirmation letter). Everyone with settings.view sees them;
 * templates.manage saves them. The logo is not set here: it stays the letterhead's.
 */
export function DocumentBrandCard() {
  const canEdit = usePermission('templates.manage');
  const brand = useQuery({
    queryKey: queryKeys.documentBrand,
    queryFn: ({ signal }) =>
      apiFetch('templates/document-brand', { schema: DocumentBrandSchema, signal }),
  });

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="size-4" aria-hidden="true" />
          Document header and footer
        </CardTitle>
        <CardDescription>
          Printed on every generated PDF: the name and address beside the logo at the top of each
          page, and the contact line at the foot.
          {brand.data?.isDefault
            ? ' Fiducial’s letterhead is printed until this is saved.'
            : brand.data?.updatedAt
              ? ` Last saved ${new Date(brand.data.updatedAt).toLocaleString('en-IN')}${brand.data.updatedBy ? ` by ${brand.data.updatedBy}` : ''}.`
              : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {brand.isPending ? (
          <LoadingState label="Loading the header and footer" />
        ) : brand.isError ? (
          <ErrorState error={brand.error} onRetry={() => void brand.refetch()} />
        ) : (
          // A save remounts the form with what was saved.
          <BrandForm key={brand.data.updatedAt ?? 'default'} saved={brand.data} canEdit={canEdit} />
        )}
      </CardContent>
    </Card>
  );
}

/** The form and its live preview, starting from the saved header and footer. */
function BrandForm({ saved, canEdit }: { saved: DocumentBrandInput; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => draftOf(saved));
  const save = useMutation({
    mutationFn: (body: DocumentBrandInput) =>
      apiFetch('templates/document-brand', { method: 'PUT', body, schema: DocumentBrandSchema }),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.documentBrand, result);
      toast({ title: 'Document header and footer saved', variant: 'success' });
    },
  });
  const parsed = DocumentBrandInputSchema.safeParse(inputOf(draft));
  const problems = parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);
  const set = (key: keyof Draft) => (event: { target: { value: string } }) =>
    setDraft((current) => ({ ...current, [key]: event.target.value }));
  const preview = inputOf(draft);

  return (
    <form
      className="grid gap-6 lg:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (parsed.success) save.mutate(parsed.data);
      }}
    >
      <fieldset className="grid gap-4" disabled={!canEdit || save.isPending}>
        <legend className="sr-only">Header and footer</legend>
        <div className="grid gap-1.5">
          <Label htmlFor="brand-name">Company name</Label>
          <Input
            id="brand-name"
            value={draft.companyName}
            maxLength={200}
            onChange={set('companyName')}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="brand-address">Address</Label>
          <Textarea
            id="brand-address"
            rows={MAX_BRAND_ADDRESS_LINES}
            value={draft.address}
            onChange={set('address')}
          />
          <p className="text-xs text-muted-foreground">
            One line per row, up to {MAX_BRAND_ADDRESS_LINES}, as the header prints them.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="brand-telephone">Telephone</Label>
            <Input
              id="brand-telephone"
              value={draft.telephone}
              maxLength={100}
              onChange={set('telephone')}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="brand-email">E-mail</Label>
            <Input id="brand-email" value={draft.email} maxLength={200} onChange={set('email')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="brand-website">Website</Label>
            <Input
              id="brand-website"
              value={draft.website}
              maxLength={200}
              onChange={set('website')}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="brand-note">Footer note</Label>
          <Input
            id="brand-note"
            value={draft.footerNote}
            maxLength={300}
            placeholder="Optional, for example a licence number"
            onChange={set('footerNote')}
          />
        </div>
        {problems.length > 0 ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{problems.join(' ')}</AlertDescription>
          </Alert>
        ) : null}
        {save.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(save.error)}</AlertDescription>
          </Alert>
        ) : null}
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!parsed.success || save.isPending}>
              {save.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              Save header and footer
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDraft(draftOf(DEFAULT_DOCUMENT_BRAND))}
            >
              Use Fiducial’s details
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            You need the Manage document templates permission to change them.
          </p>
        )}
      </fieldset>

      <figure className="grid content-start gap-2" aria-label="Preview">
        <figcaption className="text-sm font-medium">Preview</figcaption>
        <div className="rounded-md border bg-card p-4 text-xs">
          <div className="border-b-2 border-primary pb-2 text-right font-semibold leading-snug text-primary">
            <p>{preview.companyName || '—'}</p>
            {preview.addressLines.map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
          <p className="py-6 text-center text-muted-foreground">Document content</p>
          <div className="grid gap-1 border-t pt-2 text-center">
            <p className="flex justify-between text-muted-foreground">
              <span>RFQ PRP-2026-0001 · Client name</span>
              <span>Page 1 of 3</span>
            </p>
            <p className="font-semibold text-primary">
              {[
                preview.telephone ? `Tel : ${preview.telephone}` : null,
                preview.email ? `E-mail : ${preview.email}` : null,
                preview.website || null,
              ]
                .filter(Boolean)
                .join('  |  ')}
            </p>
            {preview.footerNote ? (
              <p className="text-muted-foreground">{preview.footerNote}</p>
            ) : null}
          </div>
        </div>
      </figure>
    </form>
  );
}
