'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { todayIst } from '@/lib/dates';
import { CLAIM_TYPES, CLAIM_TYPE_LABELS, type ClaimType } from '@/shared';

/** The claim's own details, shared by the staff form, the edit dialog and the employee's link. */
export interface ClaimDetailsValues {
  hospital: { name: string; city: string };
  admissionDate: string;
  dischargeDate: string;
  claimType: ClaimType;
  amountClaimed: string;
  contactEmail: string;
  contactPhone: string;
}

export const emptyClaimDetails = (contactEmail = ''): ClaimDetailsValues => ({
  hospital: { name: '', city: '' },
  admissionDate: '',
  dischargeDate: '',
  claimType: 'REIMBURSEMENT',
  amountClaimed: '',
  contactEmail,
  contactPhone: '',
});

/** Dates staff track on a claim (staff forms only, not the employee's link). */
export interface ClaimTrackingValues {
  formSubmissionDate: string;
  settlementDate: string;
}

export const claimTrackingValues = (claim?: {
  formSubmissionDate: string | null;
  settlementDate: string | null;
}): ClaimTrackingValues => ({
  formSubmissionDate: claim?.formSubmissionDate ?? '',
  settlementDate: claim?.settlementDate ?? '',
});

/** The API's message for a field ("hospital.name"), shown under it. */
export type FieldErrors = Partial<Record<string, string>>;

export function fieldErrorsOf(error: unknown): FieldErrors {
  const details = (error as { details?: unknown } | null)?.details;
  if (!Array.isArray(details)) return {};
  return Object.fromEntries(
    (details as { path?: string; message?: string }[])
      .filter((item) => item.path)
      .map((item) => [item.path!, item.message ?? '']),
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactElement;
}) {
  return (
    <Label className="grid gap-1 text-sm font-normal">
      <span>{label}</span>
      {children}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </Label>
  );
}

export function ClaimDetailsFields({
  value,
  onChange,
  errors,
}: {
  value: ClaimDetailsValues;
  onChange: (value: ClaimDetailsValues) => void;
  errors: FieldErrors;
}) {
  const set = (patch: Partial<ClaimDetailsValues>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Hospital" error={errors['hospital.name']}>
        <Input
          maxLength={200}
          value={value.hospital.name}
          onChange={(event) => set({ hospital: { ...value.hospital, name: event.target.value } })}
          aria-invalid={errors['hospital.name'] ? true : undefined}
        />
      </Field>
      <Field label="Hospital city (optional)" error={errors['hospital.city']}>
        <Input
          maxLength={100}
          value={value.hospital.city}
          onChange={(event) => set({ hospital: { ...value.hospital, city: event.target.value } })}
        />
      </Field>
      <Field label="Admission date" error={errors.admissionDate}>
        <Input
          type="date"
          max={todayIst()}
          value={value.admissionDate}
          onChange={(event) => set({ admissionDate: event.target.value })}
          aria-invalid={errors.admissionDate ? true : undefined}
        />
      </Field>
      <Field label="Discharge date" error={errors.dischargeDate}>
        <Input
          type="date"
          value={value.dischargeDate}
          onChange={(event) => set({ dischargeDate: event.target.value })}
          aria-invalid={errors.dischargeDate ? true : undefined}
        />
      </Field>
      <Field label="Claim type" error={errors.claimType}>
        <NativeSelect
          value={value.claimType}
          onChange={(event) => set({ claimType: event.target.value as ClaimType })}
        >
          {CLAIM_TYPES.map((type) => (
            <option key={type} value={type}>
              {CLAIM_TYPE_LABELS[type]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Amount claimed (₹)" error={errors.amountClaimed}>
        <Input
          inputMode="decimal"
          value={value.amountClaimed}
          onChange={(event) => set({ amountClaimed: event.target.value })}
          aria-invalid={errors.amountClaimed ? true : undefined}
        />
      </Field>
      <Field label="Contact email" error={errors.contactEmail}>
        <Input
          type="email"
          value={value.contactEmail}
          onChange={(event) => set({ contactEmail: event.target.value })}
          aria-invalid={errors.contactEmail ? true : undefined}
        />
      </Field>
      <Field label="Contact phone (optional)" error={errors.contactPhone}>
        <Input
          type="tel"
          value={value.contactPhone}
          onChange={(event) => set({ contactPhone: event.target.value })}
        />
      </Field>
    </div>
  );
}

/** Form submission and claim settlement dates (alteration 3/11/2026). Both optional. */
export function ClaimTrackingFields({
  value,
  onChange,
  errors,
}: {
  value: ClaimTrackingValues;
  onChange: (value: ClaimTrackingValues) => void;
  errors: FieldErrors;
}) {
  const set = (patch: Partial<ClaimTrackingValues>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Form submission date (optional)" error={errors.formSubmissionDate}>
        <Input
          type="date"
          max={todayIst()}
          value={value.formSubmissionDate}
          onChange={(event) => set({ formSubmissionDate: event.target.value })}
          aria-invalid={errors.formSubmissionDate ? true : undefined}
        />
      </Field>
      <Field label="Claim settlement date (optional)" error={errors.settlementDate}>
        <Input
          type="date"
          min={value.formSubmissionDate || undefined}
          value={value.settlementDate}
          onChange={(event) => set({ settlementDate: event.target.value })}
          aria-invalid={errors.settlementDate ? true : undefined}
        />
      </Field>
    </div>
  );
}
