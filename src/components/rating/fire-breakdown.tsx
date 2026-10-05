import { TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { displayRate } from '@/lib/display';
import {
  EQ_ZONE_LABELS,
  RISK_TYPE_LABELS,
  formatAmount,
  formatDate,
  formatDateTime,
  type FireRatingResponse,
} from '@/shared';

interface ComponentRow {
  label: string;
  basis: string;
  rate: string | null;
  premium: string | null;
}

/** The premium breakdown returned by POST /rating/fire, with warnings and the masters used. */
export function FireBreakdown({ result }: { result: FireRatingResponse }) {
  const { premium, snapshot, warnings } = result;
  const zone = snapshot.pincode.eqZone;
  const rows: ComponentRow[] = [
    {
      label: 'Fire',
      basis: `IIB rate for occupancy ${snapshot.occupancy.tacCode}`,
      rate: premium.rates.fire,
      premium: premium.premiums.fire,
    },
    {
      label: 'STFI',
      basis: 'Occupancy minimum STFI rate',
      rate: premium.rates.stfi,
      premium: premium.premiums.stfi,
    },
    {
      label: 'Earthquake',
      basis: `${RISK_TYPE_LABELS[snapshot.eqRiskType]} rate for pincode ${snapshot.pincode.pincode}${zone ? ` (${EQ_ZONE_LABELS[zone]})` : ''}`,
      rate: premium.rates.earthquake,
      premium: premium.premiums.earthquake,
    },
    {
      label: 'Terrorism',
      basis: premium.rates.terrorism === null ? 'Not included: no rate entered' : 'Rate entered',
      rate: premium.rates.terrorism,
      premium: premium.premiums.terrorism,
    },
  ];

  return (
    <div className="grid gap-4">
      {warnings.length > 0 ? (
        <Alert variant="warning" role="status">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>
            {warnings.length === 1 ? 'Check this before quoting' : 'Check these before quoting'}
          </AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {warnings.map((warning) => (
                <li key={warning.code}>{warning.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="pb-0">
        <CardHeader>
          <CardTitle>Indicative Fire premium</CardTitle>
          <CardDescription>
            Sum insured{' '}
            <span className="tabular font-medium text-foreground">
              ₹{formatAmount(premium.sumInsured)}
            </span>
            . Rates are per mille; add-on covers are not priced yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="pl-5">
                  Component
                </TableHead>
                <TableHead scope="col">Basis</TableHead>
                <TableHead scope="col" className="text-right">
                  Rate ‰
                </TableHead>
                <TableHead scope="col" className="pr-5 text-right">
                  Premium ₹
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.label}>
                  <TableHead
                    scope="row"
                    className="pl-5 text-sm font-medium text-foreground normal-case"
                  >
                    {row.label}
                  </TableHead>
                  <TableCell className="text-muted-foreground">{row.basis}</TableCell>
                  <TableCell className="tabular text-right">{displayRate(row.rate)}</TableCell>
                  <TableCell className="tabular pr-5 text-right">
                    {row.premium === null ? '—' : formatAmount(row.premium)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableHead
                  scope="row"
                  className="pl-5 text-sm font-medium text-foreground normal-case"
                >
                  Base premium
                </TableHead>
                <TableCell className="text-muted-foreground">
                  Policy rate (sum of the rates above)
                </TableCell>
                <TableCell className="tabular text-right">
                  {displayRate(premium.policyRate)}
                </TableCell>
                <TableCell className="tabular pr-5 text-right">
                  {formatAmount(premium.basePremium)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableHead
                  scope="row"
                  className="pl-5 text-sm font-medium text-foreground normal-case"
                >
                  Total before tax
                </TableHead>
                <TableCell colSpan={2} className="text-muted-foreground">
                  Base premium; no add-ons
                </TableCell>
                <TableCell className="tabular pr-5 text-right">
                  {formatAmount(premium.totalBeforeTax)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableHead
                  scope="row"
                  className="pl-5 text-sm font-medium text-foreground normal-case"
                >
                  GST
                </TableHead>
                <TableCell colSpan={2} className="text-muted-foreground">
                  {premium.gstRatePercent}% of the total before tax
                </TableCell>
                <TableCell className="tabular pr-5 text-right">
                  {formatAmount(premium.gst)}
                </TableCell>
              </TableRow>
              <TableRow className="bg-primary-soft hover:bg-primary-soft">
                <TableHead
                  scope="row"
                  className="pl-5 text-sm font-semibold text-primary normal-case"
                >
                  Total payable
                </TableHead>
                <TableCell colSpan={2} />
                <TableCell className="tabular pr-5 text-right text-base font-semibold text-primary">
                  ₹{formatAmount(premium.total)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Master data used</CardTitle>
          <CardDescription>
            Kept with the result so the calculation can be reproduced.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">Occupancy master</dt>
            <dd className="break-all">
              {snapshot.occupancyVersion.sourceFileName}
              {snapshot.occupancyVersion.effectiveFrom
                ? `, effective ${formatDate(snapshot.occupancyVersion.effectiveFrom)}`
                : ''}
              <span className="block text-xs text-muted-foreground">
                Version {snapshot.occupancyVersion.id}
              </span>
            </dd>
            <dt className="text-muted-foreground">Pincode master</dt>
            <dd className="break-all">
              {snapshot.pincodeVersion.sourceFileName}
              {snapshot.pincodeVersion.effectiveFrom
                ? `, effective ${formatDate(snapshot.pincodeVersion.effectiveFrom)}`
                : ''}
              <span className="block text-xs text-muted-foreground">
                Version {snapshot.pincodeVersion.id}
              </span>
            </dd>
            <dt className="text-muted-foreground">Calculated</dt>
            <dd className="tabular">{formatDateTime(result.calculatedAt)}</dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
