'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useId, useState, type ReactElement } from 'react';
import type { ZodType } from 'zod';
import { SumInsuredInput } from '@/components/rating/sum-insured-input';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { ApiError, apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  CATALOG_ITEM_SCHEMAS,
  CATALOG_SHEETS,
  catalogRowToCells,
  formatRupeesShort,
  parseCatalogCells,
  type CatalogColumn,
  type CatalogItem,
  type CatalogMaster,
} from '@/shared';

type Cells = Record<string, string>;

/** The form's text for a row: lists one entry per line. */
function formCells(master: CatalogMaster, item: CatalogItem | undefined, defaults: Cells): Cells {
  if (!item) {
    // A new row: active, other Yes/No columns off, then the page's own defaults.
    const blank = Object.fromEntries(
      CATALOG_SHEETS[master].columns.map((column) => [
        column.key,
        column.type === 'yesno' ? (column.key === 'active' ? 'Yes' : 'No') : '',
      ]),
    );
    return { ...blank, ...defaults };
  }
  const cells = catalogRowToCells(master, item);
  for (const column of CATALOG_SHEETS[master].columns) {
    if (column.type === 'list')
      cells[column.key] = (cells[column.key] ?? '').split('; ').join('\n');
  }
  return cells;
}

/** Server field errors (VALIDATION_ERROR details with body paths) by column. */
function serverFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.code !== 'VALIDATION_ERROR') return {};
  if (!Array.isArray(error.details)) return {};
  const errors: Record<string, string> = {};
  for (const detail of error.details as { path?: unknown; message?: unknown }[]) {
    if (typeof detail.path === 'string' && typeof detail.message === 'string') {
      errors[detail.path.split('.')[0] ?? ''] = detail.message;
    }
  }
  return errors;
}

function Field({
  column,
  value,
  onChange,
  error,
  locked,
}: {
  column: CatalogColumn;
  value: string;
  onChange: (value: string) => void;
  error: string | undefined;
  locked: boolean;
}) {
  const id = useId();
  const describedBy = `${id}-note`;
  const common = {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    disabled: locked,
  } as const;
  const label = `${column.header}${column.required ? '' : ' (optional)'}`;

  let control: ReactElement;
  switch (column.type) {
    case 'yesno':
      return (
        <div className="grid gap-1">
          <div className="flex items-center gap-2">
            <Checkbox
              {...common}
              checked={value === 'Yes'}
              onCheckedChange={(checked) => onChange(checked === true ? 'Yes' : 'No')}
            />
            <Label htmlFor={id} className="font-normal">
              {column.header}
            </Label>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <p id={describedBy} className="sr-only">
            {column.note}
          </p>
        </div>
      );
    case 'longtext':
    case 'list':
      control = (
        <Textarea
          {...common}
          rows={column.type === 'list' ? 5 : 4}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      );
      break;
    case 'enum':
      control = (
        <NativeSelect {...common} value={value} onChange={(event) => onChange(event.target.value)}>
          {column.required ? null : <option value="">—</option>}
          {(column.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </NativeSelect>
      );
      break;
    case 'rupees':
      control = (
        <SumInsuredInput
          {...common}
          value={value}
          onValueChange={(next) => onChange(next.split('.')[0] ?? '')}
        />
      );
      break;
    case 'date':
      control = (
        <Input {...common} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
      );
      break;
    case 'percent':
      control = (
        <div className="relative">
          <Input
            {...common}
            inputMode="decimal"
            className="pr-8"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-2 right-3 text-muted-foreground"
          >
            %
          </span>
        </div>
      );
      break;
    default:
      control = (
        <Input
          {...common}
          inputMode={column.type === 'integer' ? 'numeric' : undefined}
          value={value}
          onChange={(e) =>
            onChange(column.type === 'code' ? e.target.value.toUpperCase() : e.target.value)
          }
        />
      );
  }

  const note =
    column.type === 'list'
      ? 'One per line.'
      : column.type === 'rupees' && /^\d+$/.test(value)
        ? `${formatRupeesShort(value)}. ${column.note}`
        : column.note;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className={error ? 'text-destructive' : undefined}>
        {label}
      </Label>
      {control}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {note ? (
        <p id={describedBy} className="text-xs text-muted-foreground">
          {note}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Adds or edits one row of a product and cover master. The form is built from the master's
 * columns and checked with the same rules as the Excel upload before it is sent.
 */
export function CatalogRowDialog<M extends CatalogMaster>({
  master,
  item,
  defaults = {},
  trigger,
}: {
  master: M;
  /** The row to edit; none to add one. */
  item?: CatalogItem<M>;
  defaults?: Cells;
  trigger: ReactElement;
}) {
  const queryClient = useQueryClient();
  const spec = CATALOG_SHEETS[master];
  const [open, setOpen] = useState(false);
  const [cells, setCells] = useState<Cells>(() => formCells(master, item, defaults));
  const [errors, setErrors] = useState<Record<string, string>>({});

  // The response is checked against the master's row shape; the list is refetched for display.
  const itemSchema = CATALOG_ITEM_SCHEMAS[master] as ZodType<unknown>;
  const save = useMutation({
    mutationFn: (row: object) =>
      item
        ? apiFetch(`catalog/${master}/${item.id}`, {
            method: 'PUT',
            body: row,
            schema: itemSchema,
          })
        : apiFetch(`catalog/${master}`, {
            method: 'POST',
            body: row,
            schema: itemSchema,
          }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.all });
      // Proposals read products, sections and notes from the masters.
      void queryClient.invalidateQueries({ queryKey: ['proposals'] });
      toast({
        title: item ? 'Row saved' : 'Row added',
        description: spec.label,
        variant: 'success',
      });
      setOpen(false);
    },
    onError: (error) => setErrors(serverFieldErrors(error)),
  });

  const submit = () => {
    const parsed = parseCatalogCells(master, cells);
    if (!parsed.row) {
      setErrors(
        Object.fromEntries(parsed.issues.map((issue) => [issue.column ?? '', issue.message])),
      );
      return;
    }
    setErrors({});
    save.mutate(parsed.row);
  };

  const fieldErrorShown = spec.columns.some((column) => errors[column.key]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setCells(formCells(master, item, defaults));
          setErrors({});
          save.reset();
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {item ? 'Edit' : 'Add to'} {spec.label.toLowerCase()}
          </DialogTitle>
          <DialogDescription>
            Saved at once and recorded in the audit log. The same columns are in the “
            {spec.sheetName}” sheet of the Excel workbook.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {spec.columns.map((column) => (
            <Field
              key={column.key}
              column={column}
              value={cells[column.key] ?? ''}
              onChange={(value) => setCells((current) => ({ ...current, [column.key]: value }))}
              error={errors[column.key]}
              locked={Boolean(item) && master === 'sections' && column.key === 'code'}
            />
          ))}
          {save.isError && !fieldErrorShown ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{errorMessage(save.error)}</AlertDescription>
            </Alert>
          ) : null}
          {errors[''] ? (
            <p role="alert" className="text-sm text-destructive">
              {errors['']}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              {item ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
