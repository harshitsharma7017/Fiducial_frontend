'use client';

import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { formatInr } from '@/lib/money';
import { cn } from '@/lib/utils';
import {
  ANNEXURE_SECTIONS,
  BURGLARY_BASIS_LABELS,
  FIRE_GROUP_LABELS,
  QUOTE_OPTION_LABELS,
  RISK_DETAIL_FIELDS,
  SECTION_LINES,
  annexureColumnLabel,
  applyRfqEdits,
  formatDate,
  isAnnexureSection,
  quoteOptionsOf,
  rfqTitleOf,
  wholeRupees,
  type AnnexureColumn,
  type Client,
  type ProposalRecord,
  type RfqEdits,
  type RiskDetailKey,
  type SectionWithLines,
} from '@/shared';

// The RFQ as the insurers will read it (R-1, R-2): premium details, the schedule, risk details,
// claims, annexure and add-ons, all from the case. On the draft, the RFQ's own fields — heading,
// notes for insurers, risk details and claims — are edited in place; an edited field is marked
// and can go back to the Data Sheet's value.

const rupees = (value: string | null | undefined) =>
  value === null || value === undefined ? '—' : formatInr(wholeRupees(value));

type Claim = ProposalRecord['claims'][number];

export interface PreviewEditing {
  edits: RfqEdits;
  onChange: (edits: RfqEdits) => void;
}

function Edited({ onReset, label }: { onReset: () => void; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Badge variant="info">Edited</Badge>
      <Button type="button" variant="ghost" size="icon" className="size-6" onClick={onReset}>
        <RotateCcw aria-hidden="true" className="size-3.5" />
        <span className="sr-only">Use the Data Sheet’s {label}</span>
      </Button>
    </span>
  );
}

function Sheet({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="grid gap-3 rounded-md border bg-card p-4">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function RfqPreview({
  record: caseRecord,
  edits,
  client,
  editing,
}: {
  record: ProposalRecord;
  edits: RfqEdits;
  client: Client | undefined;
  /** Given on the draft: the fields the RFQ owns are edited in place. */
  editing?: PreviewEditing;
}) {
  const record = applyRfqEdits(caseRecord, edits);
  const renewal = record.type === 'EXISTING';
  const title = rfqTitleOf(record, edits);
  const options = quoteOptionsOf(record);
  const included = record.sections.filter((section) => section.included);
  const change = (patch: Partial<RfqEdits>) => editing?.onChange({ ...edits, ...patch });
  const riskEdit = (locationId: string, key: RiskDetailKey) =>
    edits.risk.find((entry) => entry.locationId === locationId && entry.key === key);
  const setRisk = (locationId: string, key: RiskDetailKey, value: string | null) =>
    change({
      risk: [
        ...edits.risk.filter((entry) => !(entry.locationId === locationId && entry.key === key)),
        ...(value === null ? [] : [{ locationId, key, value }]),
      ],
    });
  const claims = edits.claims ?? caseRecord.claims;
  const setClaims = (next: Claim[]) => change({ claims: next });

  return (
    <div className="grid gap-4">
      <Sheet title="Premium details">
        <div className="grid justify-items-center gap-1 text-center">
          {editing ? (
            <div className="flex w-full max-w-xl items-center gap-2">
              <Input
                aria-label="RFQ heading"
                value={edits.title ?? title}
                className="text-center font-semibold"
                onChange={(event) => change({ title: event.target.value || null })}
              />
              {edits.title ? (
                <Edited label="heading" onReset={() => change({ title: null })} />
              ) : null}
            </div>
          ) : (
            <p className="font-semibold">{title}</p>
          )}
          <p className="text-sm">Insured Name: {record.client.name}</p>
          <p className="text-sm">
            {renewal
              ? `Policy Expiry Date: ${record.existingPolicy?.periodEnd ? formatDate(record.existingPolicy.periodEnd) : '—'}`
              : `Quotes needed by: ${formatDate(record.dueDate)}`}
          </p>
        </div>
        <Table>
          <TableCaption className="sr-only">Sums insured to quote on, by option</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Coverage section</TableHead>
              {options.map((option) => (
                <TableHead key={option} className="text-right">
                  {QUOTE_OPTION_LABELS[option]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Fire</TableCell>
              {options.map((option) => (
                <TableCell key={option} className="text-right tabular">
                  {rupees(
                    option === 'EXISTING'
                      ? record.fire.existing
                      : option === 'P1'
                        ? record.fire.proposed1
                        : record.fire.proposed2,
                  )}
                </TableCell>
              ))}
            </TableRow>
            {/* B5: only sections marked required (included) appear; Not-required ones are omitted. */}
            {included.map((section) => (
              <TableRow key={section.code}>
                <TableCell>{section.name}</TableCell>
                {options.map((option) => (
                  <TableCell key={option} className="text-right tabular">
                    {rupees(
                      option === 'EXISTING'
                        ? section.existing
                        : option === 'P1'
                          ? section.proposed1
                          : section.proposed2,
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Sheet>

      <Sheet title="Schedule">
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[12rem_1fr]">
          <dt className="font-medium">Insured Name</dt>
          <dd>{record.client.name}</dd>
          <dt className="font-medium">Insured GST No</dt>
          <dd>{record.client.gstin ?? 'Not registered'}</dd>
          <dt className="font-medium">Communication Address</dt>
          <dd>
            {client
              ? [
                  client.address.line1,
                  client.address.line2,
                  client.address.city,
                  `${client.address.state} ${client.address.pincode}`,
                ]
                  .filter(Boolean)
                  .join(', ')
              : '…'}
          </dd>
          <dt className="font-medium">Risk Location</dt>
          <dd className="grid">
            {record.locations.map((location) => (
              <span key={location.locationId}>
                {location.location?.name ?? 'Location'}
                {record.locations.length > 1
                  ? ` — Fire sum insured ${rupees(location.fireTotal)}`
                  : ''}
              </span>
            ))}
          </dd>
          <dt className="font-medium">Policy Period</dt>
          <dd>
            {record.policyStart && record.policyEnd
              ? `${formatDate(record.policyStart)} to ${formatDate(record.policyEnd)}`
              : 'For 1 year from date of payment'}
          </dd>
          <dt className="font-medium">Nature of business</dt>
          <dd>{client?.natureOfBusiness ?? '…'}</dd>
          <dt className="font-medium">Occupancy</dt>
          <dd>{client ? `${client.occupancy.tacCode} — ${client.occupancy.description}` : '…'}</dd>
          {record.product ? (
            <>
              <dt className="font-medium">Policy</dt>
              <dd>{record.product.name}</dd>
            </>
          ) : null}
        </dl>

        <FiguresTable
          caption="Fire & Allied Perils"
          renewal={renewal}
          rows={[
            ...record.fire.groups
              .filter(
                (line) =>
                  line.proposed1 !== '0' || line.proposed2 !== null || line.existing !== null,
              )
              .map((line) => ({
                label: FIRE_GROUP_LABELS[line.group],
                existing: line.existing,
                p1: line.proposed1,
                p2: line.proposed2,
              })),
            {
              label: 'Total Sum Insured - Fire & Allied Perils',
              existing: record.fire.existing,
              p1: record.fire.proposed1,
              p2: record.fire.proposed2,
              total: true,
            },
          ]}
          covers={record.fire.covers}
        />

        {included.map((section) => {
          const lines = (SECTION_LINES[section.code as SectionWithLines] ?? []) as readonly {
            key: string;
            label: string;
          }[];
          return (
            <FiguresTable
              key={section.code}
              caption={section.name}
              renewal={renewal}
              rows={[
                ...lines.map((line) => ({
                  label: line.label,
                  existing: section.existingLines[line.key] ?? null,
                  p1: section.lines[line.key] ?? null,
                  p2: section.lines2[line.key] ?? null,
                })),
                {
                  label: isAnnexureSection(section.code) ? 'As per Annexure' : 'Sum insured',
                  existing: section.existing,
                  p1: section.proposed1,
                  p2: section.proposed2,
                  total: true,
                },
                ...(section.basis && section.basisAmounts
                  ? [
                      {
                        label: `On ${BURGLARY_BASIS_LABELS[section.basis]}`,
                        existing: null,
                        p1: section.basisAmounts.proposed1,
                        p2: section.basisAmounts.proposed2,
                      },
                    ]
                  : []),
              ]}
              covers={section.covers}
            />
          );
        })}
        {/* B5: the "Not required: …" line is removed; Not-required sections are simply omitted. */}

        <div className="grid gap-1 text-sm">
          <p className="font-medium">NOTE:</p>
          {record.locations.map((location) =>
            location.hypothecation ? (
              <p key={`h-${location.locationId}`}>
                Hypothecation ({location.location?.name ?? 'Location'}): {location.hypothecation}
              </p>
            ) : null,
          )}
          {record.locations.map((location) =>
            location.openStock ? (
              <p key={`o-${location.locationId}`}>
                Stock kept at open space ({location.location?.name ?? 'Location'}):{' '}
                {location.openStock}
              </p>
            ) : null,
          )}
          {editing ? (
            <div className="grid gap-1">
              <div className="flex items-center gap-2">
                <label htmlFor="rfq-notes" className="text-sm">
                  Notes for the insurers
                </label>
                {edits.notes !== null ? (
                  <Edited label="notes" onReset={() => change({ notes: null })} />
                ) : null}
              </div>
              <Textarea
                id="rfq-notes"
                rows={2}
                maxLength={1000}
                value={edits.notes ?? caseRecord.notes ?? ''}
                onChange={(event) => change({ notes: event.target.value || null })}
              />
            </div>
          ) : record.notes ? (
            <p>Notes for the insurers: {record.notes}</p>
          ) : null}
        </div>
        {record.addons.length > 0 ? (
          <div className="grid gap-1 text-sm">
            <p className="font-medium">Additional add-on covers (attached list)</p>
            <ul className="list-disc pl-5">
              {record.addons.map((addon) => (
                <li key={`${addon.list}-${addon.name}`}>{addon.name}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Sheet>

      <Sheet title="Risk details">
        <div className="overflow-x-auto">
          <Table>
            <TableCaption className="sr-only">Risk details by location</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Detail</TableHead>
                {record.locations.map((location) => (
                  <TableHead key={location.locationId}>
                    {location.location?.name ?? 'Location'}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {RISK_DETAIL_FIELDS.map((field, index) => (
                <TableRow key={field.key}>
                  <TableCell className="whitespace-normal">
                    {index + 1}. {field.label}
                  </TableCell>
                  {record.locations.map((location) => {
                    const edit = riskEdit(location.locationId, field.key);
                    const value = location.risk[field.key] ?? '';
                    const name = `${field.label}, ${location.location?.name ?? 'location'}`;
                    return (
                      <TableCell
                        key={location.locationId}
                        className={cn('min-w-48 whitespace-normal', edit && 'bg-info-soft')}
                      >
                        {editing ? (
                          <div className="flex items-center gap-1">
                            <Input
                              aria-label={name}
                              value={value}
                              onChange={(event) =>
                                setRisk(location.locationId, field.key, event.target.value)
                              }
                            />
                            {edit ? (
                              <Edited
                                label={name}
                                onReset={() => setRisk(location.locationId, field.key, null)}
                              />
                            ) : null}
                          </div>
                        ) : (
                          value || '—'
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Sheet>

      <Sheet title="Claim details">
        <div className="flex items-center gap-2">
          <p className="text-sm">Past 3 years claim details</p>
          {editing && edits.claims !== null ? (
            <Edited label="claims" onReset={() => change({ claims: null })} />
          ) : null}
        </div>
        {claims.length === 0 && !editing ? (
          <p className="text-sm">No claims reported</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableCaption className="sr-only">Claims in the past 3 years</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Policy period</TableHead>
                  <TableHead>Policy type</TableHead>
                  <TableHead className="text-right">Sum insured</TableHead>
                  <TableHead className="text-right">Premium</TableHead>
                  <TableHead className="text-right">Claimed</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead>Insurer</TableHead>
                  {editing ? <TableHead /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((claim, index) => {
                  const cell = (key: keyof Claim, label: string, numeric = false) =>
                    editing ? (
                      <Input
                        aria-label={`Claim ${index + 1} ${label}`}
                        inputMode={numeric ? 'numeric' : undefined}
                        className={cn('min-w-24', numeric && 'text-right')}
                        value={claim[key] ?? ''}
                        onChange={(event) =>
                          setClaims(
                            claims.map((item, position) =>
                              position === index
                                ? {
                                    ...item,
                                    [key]: event.target.value || (key === 'period' ? '' : null),
                                  }
                                : item,
                            ),
                          )
                        }
                      />
                    ) : numeric ? (
                      rupees(claim[key])
                    ) : (
                      (claim[key] ?? '—')
                    );
                  return (
                    <TableRow key={index}>
                      <TableCell>{cell('period', 'policy period')}</TableCell>
                      <TableCell>{cell('policyType', 'policy type')}</TableCell>
                      <TableCell className="text-right tabular">
                        {cell('sumInsured', 'sum insured', true)}
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {cell('premium', 'premium', true)}
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {cell('claimedAmount', 'claimed amount', true)}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {cell('remarks', 'remarks')}
                      </TableCell>
                      <TableCell>{cell('insurer', 'insurer')}</TableCell>
                      {editing ? (
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() =>
                              setClaims(claims.filter((_, position) => position !== index))
                            }
                          >
                            <Trash2 aria-hidden="true" />
                            <span className="sr-only">Remove claim {index + 1}</span>
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {editing && claims.length < 3 ? (
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setClaims([
                  ...claims,
                  {
                    period: '',
                    policyType: null,
                    sumInsured: null,
                    premium: null,
                    claimedAmount: null,
                    remarks: null,
                    insurer: null,
                  },
                ])
              }
            >
              <Plus aria-hidden="true" />
              Add a claim
            </Button>
          </div>
        ) : null}
      </Sheet>

      {included.some(
        (section) => isAnnexureSection(section.code) && section.annexure.length > 0,
      ) ? (
        <Sheet title="Annexure">
          {included.map((section) => {
            if (!isAnnexureSection(section.code) || section.annexure.length === 0) return null;
            const code = section.code;
            const columns = ANNEXURE_SECTIONS[code].columns as readonly AnnexureColumn[];
            return (
              <Table key={code}>
                <TableCaption className="caption-top text-left font-medium text-foreground">
                  {ANNEXURE_SECTIONS[code].title}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>S No</TableHead>
                    {columns.map((column) => (
                      <TableHead key={column}>{annexureColumnLabel(code, column)}</TableHead>
                    ))}
                    <TableHead className="text-right">Sum insured</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {section.annexure.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>{index + 1}</TableCell>
                      {columns.map((column) => (
                        <TableCell key={column}>{row[column] ?? '—'}</TableCell>
                      ))}
                      <TableCell className="text-right tabular">{rupees(row.sumInsured)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            );
          })}
        </Sheet>
      ) : null}
    </div>
  );
}

function FiguresTable({
  caption,
  renewal,
  rows,
  covers,
}: {
  caption: string;
  renewal: boolean;
  rows: {
    label: string;
    existing: string | null;
    p1: string | null;
    p2: string | null;
    total?: boolean;
  }[];
  covers: readonly { name: string; required: boolean | null }[];
}) {
  return (
    <Table>
      <TableCaption className="caption-top text-left font-medium text-foreground">
        {caption}
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Description</TableHead>
          {renewal ? <TableHead className="text-right">Existing</TableHead> : null}
          <TableHead className="text-right">Proposed – Option 1</TableHead>
          <TableHead className="text-right">Proposed – Option 2</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.label} className={row.total ? 'font-medium' : undefined}>
            <TableCell className="whitespace-normal">{row.label}</TableCell>
            {renewal ? (
              <TableCell className="text-right tabular">{rupees(row.existing)}</TableCell>
            ) : null}
            <TableCell className="text-right tabular">{rupees(row.p1)}</TableCell>
            <TableCell className="text-right tabular">{rupees(row.p2)}</TableCell>
          </TableRow>
        ))}
        {covers
          .filter((cover) => cover.required !== null)
          .map((cover) => (
            <TableRow key={cover.name}>
              <TableCell className="text-muted-foreground">Add-on: {cover.name}</TableCell>
              {renewal ? <TableCell /> : null}
              <TableCell className="text-right">
                {cover.required ? 'Required' : 'Not required'}
              </TableCell>
              <TableCell />
            </TableRow>
          ))}
      </TableBody>
    </Table>
  );
}
