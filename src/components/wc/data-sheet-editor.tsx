'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { newRowId, wcKeys } from '@/lib/wc/api';
import {
  MAX_WC_CATEGORIES,
  MAX_WC_CLAUSES,
  MAX_WC_COVERAGE_OPTIONS,
  WcCaseSchema,
  WcDataSheetInputSchema,
  formatIndianNumber,
  type WcCase,
  type WcExpiringPolicy,
} from '@/shared';
import { TextList } from './text-list';

interface CategoryDraft {
  id: string;
  designation: string;
  persons: string;
  monthlyWage: string;
}

type ExpiringDraft = Record<keyof WcExpiringPolicy, string>;

interface Draft {
  policyPeriod: string;
  natureOfBusiness: string;
  workingHeight: string;
  riskLocation: string;
  categoryDescription: string;
  categories: CategoryDraft[];
  coverageOptions: { id: string; label: string }[];
  clauses: string[];
  conditions: string[];
  expiring: ExpiringDraft | null;
}

const EXPIRING_FIELDS: { key: keyof WcExpiringPolicy; label: string; numeric?: boolean }[] = [
  { key: 'policyYear', label: 'Policy year (e.g. 2024-25)' },
  { key: 'policyNumber', label: 'Policy number' },
  { key: 'insurer', label: 'Insurer' },
  { key: 'persons', label: 'No of persons', numeric: true },
  { key: 'sumInsured', label: 'Sum insured (₹)', numeric: true },
  { key: 'premiumInclGst', label: 'Premium incl GST (₹)', numeric: true },
  { key: 'coverageOption', label: 'Coverage option' },
  { key: 'claimAmount', label: 'Claim amount (₹)', numeric: true },
  { key: 'changes', label: 'Changes in renewal quote' },
];

const draftOf = (record: WcCase): Draft => ({
  policyPeriod: record.policyPeriod,
  natureOfBusiness: record.natureOfBusiness ?? '',
  workingHeight: record.workingHeight ?? '',
  riskLocation: record.riskLocation ?? '',
  categoryDescription: record.categoryDescription ?? '',
  categories: record.categories.map((category) => ({
    id: category.id,
    designation: category.designation,
    persons: String(category.persons),
    monthlyWage: category.monthlyWage === '0' ? '' : category.monthlyWage,
  })),
  coverageOptions: record.coverageOptions.map((option) => ({ ...option })),
  clauses: [...record.clauses],
  conditions: [...record.conditions],
  expiring:
    record.type !== 'NEW'
      ? (Object.fromEntries(
          EXPIRING_FIELDS.map(({ key }) => [key, String(record.expiringPolicy?.[key] ?? '')]),
        ) as ExpiringDraft)
      : null,
});

const digits = (value: string) => value.replace(/[,\s₹]/g, '');
const blank = (value: string) => (value.trim() ? value.trim() : null);

/** The request the draft stands for (checked by the shared schema before it is sent). */
function inputOf(draft: Draft) {
  const expiring = draft.expiring;
  return {
    policyPeriod: draft.policyPeriod.trim(),
    natureOfBusiness: blank(draft.natureOfBusiness),
    workingHeight: blank(draft.workingHeight),
    riskLocation: blank(draft.riskLocation),
    categoryDescription: blank(draft.categoryDescription),
    categories: draft.categories.map((category) => ({
      id: category.id,
      designation: category.designation.trim(),
      persons: Number(digits(category.persons) || '0'),
      monthlyWage: digits(category.monthlyWage) || '0',
    })),
    coverageOptions: draft.coverageOptions.map((option) => ({
      id: option.id,
      label: option.label.trim(),
    })),
    clauses: draft.clauses.map((clause) => clause.trim()),
    conditions: draft.conditions.map((condition) => condition.trim()),
    expiringPolicy: expiring
      ? {
          policyYear: blank(expiring.policyYear),
          policyNumber: blank(expiring.policyNumber),
          insurer: blank(expiring.insurer),
          persons: digits(expiring.persons) ? Number(digits(expiring.persons)) : null,
          sumInsured: digits(expiring.sumInsured) || null,
          premiumInclGst: digits(expiring.premiumInclGst) || null,
          coverageOption: blank(expiring.coverageOption),
          claimAmount: digits(expiring.claimAmount) || null,
          changes: blank(expiring.changes),
        }
      : null,
  };
}

const inr = (value: bigint) => `₹${formatIndianNumber(value.toString(), 0)}`;
const monthlyOf = (category: CategoryDraft) => {
  const persons = digits(category.persons);
  const wage = digits(category.monthlyWage);
  return /^\d+$/.test(persons) && /^\d+$/.test(wage) ? BigInt(persons) * BigInt(wage) : 0n;
};

/**
 * The workmen compensation Data Sheet: the risk, any number of worker categories, the coverage
 * options insurers quote, the clauses and conditions printed on the RFQ, and a renewal's
 * expiring policy. Every list is added to or trimmed per proposal.
 */
export function DataSheetEditor({ record, canEdit }: { record: WcCase; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => draftOf(record));
  const save = useMutation({
    mutationFn: (body: unknown) =>
      apiFetch(`wc/cases/${record.id}/data-sheet`, {
        method: 'PUT',
        body,
        schema: WcCaseSchema,
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(wcKeys.case(record.id), saved);
      void queryClient.invalidateQueries({ queryKey: wcKeys.list() });
      toast({ title: 'Data Sheet saved', variant: 'success' });
    },
  });
  const parsed = WcDataSheetInputSchema.safeParse(inputOf(draft));
  const problems = parsed.success
    ? []
    : [...new Set(parsed.error.issues.map((issue) => issue.message))];
  const disabled = !canEdit || save.isPending;
  const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const setCategory = (index: number, patch: Partial<CategoryDraft>) =>
    update({
      categories: draft.categories.map((category, at) =>
        at === index ? { ...category, ...patch } : category,
      ),
    });
  const totalPersons = draft.categories.reduce(
    (sum, category) => sum + Number(digits(category.persons) || '0'),
    0,
  );
  const totalMonthly = draft.categories.reduce((sum, category) => sum + monthlyOf(category), 0n);
  const text = (key: keyof Draft, label: string, placeholder?: string) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`wc-${key}`}>{label}</Label>
      <Input
        id={`wc-${key}`}
        value={draft[key] as string}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => update({ [key]: event.target.value })}
      />
    </div>
  );

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (parsed.success) save.mutate(parsed.data);
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Risk details</CardTitle>
          <CardDescription>Printed above the employee details on every document.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {text('policyPeriod', 'Policy period')}
          {text('natureOfBusiness', 'Nature of business / job')}
          {text('workingHeight', 'Working height', 'For example, Above 9 Meter')}
          {text('riskLocation', 'Risk location', 'For example, Anywhere in India')}
          <div className="sm:col-span-2">
            {text(
              'categoryDescription',
              'Category (who is covered)',
              'For example, All types of employees including contract and sub-contract workers',
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employee details</CardTitle>
          <CardDescription>
            Each category of workers with its number of persons and wages per person per month.
            Annual wages are worked out.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">S.No</TableHead>
                  <TableHead>Category of workers / designation</TableHead>
                  <TableHead className="text-right">No of persons</TableHead>
                  <TableHead className="text-right">Wages per person per month (₹)</TableHead>
                  <TableHead className="text-right">Total annual wages</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Remove</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draft.categories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No category yet. Add the categories of workers to cover.
                    </TableCell>
                  </TableRow>
                ) : (
                  draft.categories.map((category, index) => (
                    <TableRow key={category.id}>
                      <TableCell className="tabular">{index + 1}</TableCell>
                      <TableCell>
                        <Input
                          aria-label={`Category ${index + 1}`}
                          value={category.designation}
                          maxLength={200}
                          disabled={disabled}
                          onChange={(event) =>
                            setCategory(index, { designation: event.target.value })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          aria-label={`Persons in category ${index + 1}`}
                          inputMode="numeric"
                          className="text-right"
                          value={category.persons}
                          disabled={disabled}
                          onChange={(event) => setCategory(index, { persons: event.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          aria-label={`Monthly wage per person in category ${index + 1}`}
                          inputMode="numeric"
                          className="text-right"
                          value={category.monthlyWage}
                          disabled={disabled}
                          onChange={(event) =>
                            setCategory(index, { monthlyWage: event.target.value })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {inr(monthlyOf(category) * 12n)}
                      </TableCell>
                      <TableCell>
                        {disabled ? null : (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={`Remove category ${index + 1}`}
                            onClick={() =>
                              update({
                                categories: draft.categories.filter((_other, at) => at !== index),
                              })
                            }
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-medium">
                    Total
                  </TableCell>
                  <TableCell className="text-right font-medium tabular">{totalPersons}</TableCell>
                  <TableCell className="text-right font-medium tabular">
                    {inr(totalMonthly)} / month
                  </TableCell>
                  <TableCell className="text-right font-medium tabular">
                    {inr(totalMonthly * 12n)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
          {disabled ? null : (
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={draft.categories.length >= MAX_WC_CATEGORIES}
                onClick={() =>
                  update({
                    categories: [
                      ...draft.categories,
                      { id: newRowId('c'), designation: '', persons: '', monthlyWage: '' },
                    ],
                  })
                }
              >
                <Plus aria-hidden="true" />
                Add category
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coverage options</CardTitle>
          <CardDescription>
            Each insurer quotes a premium (GST included) for every option, for example with or
            without medical expenses.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          <ol className="grid gap-2">
            {draft.coverageOptions.map((option, index) => (
              <li key={option.id} className="flex items-center gap-2">
                <span className="w-6 text-right text-sm text-muted-foreground tabular">
                  {index + 1}.
                </span>
                <Input
                  aria-label={`Coverage option ${index + 1}`}
                  value={option.label}
                  maxLength={200}
                  disabled={disabled}
                  onChange={(event) =>
                    update({
                      coverageOptions: draft.coverageOptions.map((other, at) =>
                        at === index ? { ...other, label: event.target.value } : other,
                      ),
                    })
                  }
                />
                {disabled ? null : (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove coverage option ${index + 1}`}
                    onClick={() =>
                      update({
                        coverageOptions: draft.coverageOptions.filter((_o, at) => at !== index),
                      })
                    }
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                )}
              </li>
            ))}
          </ol>
          {disabled ? null : (
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={draft.coverageOptions.length >= MAX_WC_COVERAGE_OPTIONS}
                onClick={() =>
                  update({
                    coverageOptions: [...draft.coverageOptions, { id: newRowId('o'), label: '' }],
                  })
                }
              >
                <Plus aria-hidden="true" />
                Add coverage option
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Clauses to be attached</CardTitle>
          </CardHeader>
          <CardContent>
            <TextList
              label="Clause"
              items={draft.clauses}
              onChange={(clauses) => update({ clauses })}
              disabled={disabled}
              max={MAX_WC_CLAUSES}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Conditions</CardTitle>
          </CardHeader>
          <CardContent>
            <TextList
              label="Condition"
              items={draft.conditions}
              onChange={(conditions) => update({ conditions })}
              disabled={disabled}
              max={MAX_WC_CLAUSES}
            />
          </CardContent>
        </Card>
      </div>

      {draft.expiring ? (
        <Card>
          <CardHeader>
            <CardTitle>Expiring policy</CardTitle>
            <CardDescription>
              The policy being renewed, printed at the end of the RFQ.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            {EXPIRING_FIELDS.map(({ key, label, numeric }) => (
              <div key={key} className="grid gap-1.5">
                <Label htmlFor={`wc-expiring-${key}`}>{label}</Label>
                <Input
                  id={`wc-expiring-${key}`}
                  inputMode={numeric ? 'decimal' : undefined}
                  value={draft.expiring?.[key] ?? ''}
                  disabled={disabled}
                  onChange={(event) =>
                    update({
                      expiring: draft.expiring
                        ? { ...draft.expiring, [key]: event.target.value }
                        : null,
                    })
                  }
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {canEdit ? (
        <div className="grid gap-2">
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
          <div>
            <Button type="submit" disabled={!parsed.success || save.isPending}>
              {save.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              Save Data Sheet
            </Button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
