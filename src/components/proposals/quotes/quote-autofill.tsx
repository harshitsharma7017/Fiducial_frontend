'use client';

import { CircleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { formatDate, formatIndianNumber } from '@/shared';
import {
  OCR_READER_LABELS,
  OCR_REVIEW_STATE_LABELS,
  type OcrField,
  type OcrReader,
  type OcrReviewState,
  type QuoteExpectation,
  type QuoteExtraction,
} from '@/shared';

// Auto-fill of the quote form from the insurer's PDF or picture (Q1). The values are only
// candidates: they land in the ordinary form fields, each is listed here with the line it came
// from and how sure the reader was, and the quote cannot be saved until the person says they
// checked them. Which reader read the file (built in, or Gemini outside the server) is shown.

export interface FilledValue {
  label: string;
  /** The value as shown (₹ amounts or a date). */
  shown: string;
  raw: string | null;
  state: OcrReviewState;
}
export interface FillSummary {
  fileName: string;
  /** "PDF" or "file", for the wording. */
  document: string;
  reader: OcrReader;
  values: FilledValue[];
  /** Sections the RFQ asked for that the PDF did not give a premium for. */
  notFound: string[];
  /** What the PDF states for the whole quote, to compare with the form's totals. */
  stated: Array<{ label: string; shown: string }>;
  /** Whose quote the PDF says it is, to check it is the right insurer's file. */
  named: Array<{ label: string; shown: string }>;
  discrepancies: string[];
  manualEntryRequired: boolean;
}

const rupees = (value: string) => `₹${formatIndianNumber(value, 2)}`;

type SetValue = (
  name: string,
  value: string,
  options: { shouldDirty: boolean; shouldValidate: boolean },
) => void;

/**
 * Puts the PDF's values in the form (only where it gave a value, and only for the sections the
 * RFQ asked for) and returns what was done, for the review panel.
 */
export function applyExtraction(
  extraction: QuoteExtraction,
  fileName: string,
  expectation: QuoteExpectation,
  setValue: SetValue,
): FillSummary {
  const values: FilledValue[] = [];
  const notFound: string[] = [];
  const options = { shouldDirty: true, shouldValidate: true };
  const put = (path: string, label: string, candidate: OcrField, shown: (v: string) => string) => {
    if (candidate.value === null) return false;
    setValue(path, candidate.value, options);
    values.push({
      label,
      shown: shown(candidate.value),
      raw: candidate.raw,
      state: candidate.state,
    });
    return true;
  };
  expectation.sections.forEach((section, index) => {
    const found = extraction.sections.find((item) => item.code === section.code);
    const premium = found
      ? put(
          `sections.${index}.premium`,
          `${section.name}${section.code === 'FIRE' ? ' (with terrorism)' : ''} premium`,
          found.premium,
          rupees,
        )
      : false;
    if (found && section.code === 'FIRE') {
      put(
        `sections.${index}.premiumWithoutTerrorism`,
        'Fire premium (without terrorism)',
        found.premiumWithoutTerrorism,
        rupees,
      );
    }
    if (!premium) notFound.push(section.name);
  });
  put('validUntil', 'Valid until', extraction.validUntil, (value) => formatDate(value));
  const stated = (
    [
      ['Net premium', extraction.netPremium],
      ['GST', extraction.gstAmount],
      ['Total premium', extraction.totalPremium],
    ] as const
  ).flatMap(([label, candidate]) =>
    candidate.value === null ? [] : [{ label, shown: rupees(candidate.value) }],
  );
  const named = (
    [
      ['Insurer', extraction.insurerName],
      ['Quotation no.', extraction.quoteReference],
    ] as const
  ).flatMap(([label, candidate]) =>
    candidate.value === null ? [] : [{ label, shown: candidate.value }],
  );
  return {
    fileName,
    document: /\.pdf$/i.test(fileName) ? 'PDF' : 'file',
    reader: extraction.reader,
    values,
    notFound,
    stated,
    named,
    discrepancies: extraction.discrepancies,
    manualEntryRequired: extraction.manualEntryRequired,
  };
}

/** What was filled from the PDF, with the checkbox that must be ticked before saving. */
export function FillReview({
  summary,
  checked,
  onChecked,
  showError,
}: {
  summary: FillSummary;
  checked: boolean;
  onChecked: (checked: boolean) => void;
  showError: boolean;
}) {
  if (summary.manualEntryRequired) {
    return (
      <Alert role="status">
        <CircleAlert aria-hidden="true" />
        <AlertTitle>Nothing could be read from {summary.fileName}</AlertTitle>
        <AlertDescription>{summary.discrepancies.join(' ')}</AlertDescription>
      </Alert>
    );
  }
  return (
    <section aria-labelledby="quote-fill" className="grid gap-3 rounded-md border p-3">
      <h3 id="quote-fill" className="text-sm font-semibold">
        Filled from {summary.fileName}: check each value against the {summary.document}
      </h3>
      {summary.reader === 'GEMINI' ? (
        <p className="text-xs text-muted-foreground">
          Read by {OCR_READER_LABELS.GEMINI}. A value marked “Read clearly” was also found in the
          PDF’s own text; every other value could not be checked by the system.
        </p>
      ) : null}
      {summary.named.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          The {summary.document} names{' '}
          {summary.named.map((item) => `${item.label} ${item.shown}`).join(', ')}. Check it is this
          insurer’s quote.
        </p>
      ) : null}
      {summary.values.length > 0 ? (
        <ul className="grid gap-1 text-sm">
          {summary.values.map((item) => (
            <li key={item.label} className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium">{item.label}:</span>
              <span className="tabular">{item.shown}</span>
              <Badge variant={item.state === 'HIGH' ? 'success' : 'warning'}>
                {OCR_REVIEW_STATE_LABELS[item.state]}
              </Badge>
              {item.raw ? (
                <span className="text-xs text-muted-foreground">from “{item.raw}”</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {summary.notFound.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Not found in the {summary.document}, enter by hand: {summary.notFound.join(', ')}.
        </p>
      ) : null}
      {summary.stated.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          The {summary.document} states{' '}
          {summary.stated.map((item) => `${item.label} ${item.shown}`).join(', ')}. Compare them
          with the totals below.
        </p>
      ) : null}
      {summary.discrepancies.map((message) => (
        <Alert key={message} variant="warning" role="status">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ))}
      <Label className="flex items-center gap-2 text-sm font-normal">
        <Checkbox checked={checked} onCheckedChange={(value) => onChecked(value === true)} />I have
        checked the values filled from the {summary.document} against the {summary.document}
      </Label>
      {showError && !checked ? (
        <p role="alert" className="text-sm text-destructive">
          Tick this once you have checked the values, or clear them and enter them by hand.
        </p>
      ) : null}
    </section>
  );
}
