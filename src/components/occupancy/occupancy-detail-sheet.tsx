'use client';

import { Pencil } from 'lucide-react';
import type { ReactNode } from 'react';
import { OccupancyFormSheet } from '@/components/occupancy/occupancy-form-sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePermission } from '@/hooks/use-permission';
import { displayRate, riskTypeLabel } from '@/lib/display';
import { EQ_ZONES, EQ_ZONE_LABELS, type Occupancy } from '@/shared';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-3 border-b py-2.5 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function OccupancyDetailSheet({
  occupancy,
  open,
  onOpenChange,
  onUpdated,
}: {
  occupancy: Occupancy | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the occupancy after an Admin edits it here. */
  onUpdated?: (occupancy: Occupancy) => void;
}) {
  const canManage = usePermission('masters.manage');
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        {occupancy ? (
          <>
            <SheetHeader>
              <SheetTitle>
                <span className="tabular">{occupancy.tacCode}</span> ·{' '}
                {occupancy.description || 'No description'}
              </SheetTitle>
              <SheetDescription>
                Occupancy master record from the active IIB version
              </SheetDescription>
              {canManage ? (
                <div className="pt-2">
                  <OccupancyFormSheet
                    occupancy={occupancy}
                    onSaved={onUpdated}
                    trigger={
                      <Button size="sm" variant="outline">
                        <Pencil aria-hidden="true" />
                        Edit
                      </Button>
                    }
                  />
                </div>
              ) : null}
            </SheetHeader>
            <div className="overflow-y-auto px-5 pb-6">
              <dl className="text-sm">
                <Field label="TAC code">
                  <span className="tabular">{occupancy.tacCode}</span>
                </Field>
                <Field label="S No">{occupancy.serialNo ?? '—'}</Field>
                <Field label="Description">{occupancy.description || '—'}</Field>
                <Field label="Risk grade">
                  {occupancy.riskGrade ?? <Badge variant="warning">Blank</Badge>}
                </Field>
                <Field label="IIB rate (per mille)">
                  {occupancy.iibRate ? (
                    <span className="tabular">{displayRate(occupancy.iibRate)}</span>
                  ) : (
                    <span className="grid gap-1">
                      <Badge variant="warning">No numeric rate</Badge>
                      {occupancy.iibRateNote ? (
                        <span className="text-muted-foreground">“{occupancy.iibRateNote}”</span>
                      ) : null}
                    </span>
                  )}
                </Field>
                <Field label="Fire risk type">
                  {occupancy.fireRiskType ? (
                    riskTypeLabel(occupancy.fireRiskType)
                  ) : (
                    <Badge variant="warning">Blank</Badge>
                  )}
                </Field>
                <Field label="Terrorism risk type">
                  {occupancy.terrorismRiskType ? (
                    riskTypeLabel(occupancy.terrorismRiskType)
                  ) : (
                    <Badge variant="warning">Blank</Badge>
                  )}
                </Field>
                <Field label="Min STFI rate (per mille)">
                  <span className="tabular">{displayRate(occupancy.minStfiRate)}</span>
                </Field>
              </dl>

              <h3 className="mt-5 mb-2 text-sm font-semibold">
                Minimum EQ rate by zone (per mille)
              </h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {EQ_ZONES.map((zone) => (
                        <TableHead key={zone} className="text-right">
                          {EQ_ZONE_LABELS[zone]}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      {EQ_ZONES.map((zone) => (
                        <TableCell key={zone} className="tabular text-right">
                          {displayRate(occupancy.minEqRates[`zone${zone}`])}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Zone I has the highest earthquake rates and Zone IV the lowest.
              </p>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
