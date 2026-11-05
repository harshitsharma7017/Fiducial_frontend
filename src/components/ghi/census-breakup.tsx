import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CENSUS_GROUPS, CENSUS_GROUP_LABELS, type GhiCensusSummary } from '@/shared';

/**
 * The employee age-wise and family-wise breakup (client review 4/11/2026), for GMC, GPA and GTLI:
 * each age band's lives by relationship group, and families by who they cover. The same tables go
 * in the census annexure of the RFQ, QCR and placement slip.
 */
export function CensusBreakup({ summary }: { summary: GhiCensusSummary }) {
  const bands = summary.byAgeBandAndGroup ?? [];
  const families = summary.byFamily ?? [];
  if (bands.length === 0 && families.length === 0) return null;
  const groupTotal = (group: (typeof CENSUS_GROUPS)[number]) =>
    bands.reduce((sum, band) => sum + (band.groups[group] ?? 0), 0);
  return (
    <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
      {bands.length > 0 ? (
        <div
          role="region"
          aria-label="Lives by age band and relationship"
          tabIndex={0}
          className="overflow-x-auto rounded-md border"
        >
          <Table>
            <caption className="px-3 pt-2 text-left text-sm font-medium">
              Lives by age band and relationship
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead>Age band</TableHead>
                {CENSUS_GROUPS.map((group) => (
                  <TableHead key={group} className="text-right">
                    {CENSUS_GROUP_LABELS[group]}
                  </TableHead>
                ))}
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bands.map((band) => (
                <TableRow key={band.band}>
                  <TableCell>{band.label}</TableCell>
                  {CENSUS_GROUPS.map((group) => (
                    <TableCell key={group} className="text-right tabular">
                      {band.groups[group] ?? 0}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-medium tabular">{band.lives}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold">
                <TableCell>Total</TableCell>
                {CENSUS_GROUPS.map((group) => (
                  <TableCell key={group} className="text-right tabular">
                    {groupTotal(group)}
                  </TableCell>
                ))}
                <TableCell className="text-right tabular">
                  {bands.reduce((sum, band) => sum + band.lives, 0)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      ) : null}
      {families.length > 0 ? (
        <div
          role="region"
          aria-label="Family-wise breakup"
          tabIndex={0}
          className="overflow-x-auto rounded-md border"
        >
          <Table>
            <caption className="px-3 pt-2 text-left text-sm font-medium">
              Family-wise breakup
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead>Family</TableHead>
                <TableHead className="text-right">Families</TableHead>
                <TableHead className="text-right">Lives</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {families.map((family) => (
                <TableRow key={family.label}>
                  <TableCell>{family.label}</TableCell>
                  <TableCell className="text-right tabular">{family.families}</TableCell>
                  <TableCell className="text-right tabular">{family.lives}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right tabular">
                  {families.reduce((sum, family) => sum + family.families, 0)}
                </TableCell>
                <TableCell className="text-right tabular">
                  {families.reduce((sum, family) => sum + family.lives, 0)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
