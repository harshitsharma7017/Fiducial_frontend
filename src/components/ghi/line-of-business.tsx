import { Building2, HeartPulse } from 'lucide-react';
import { cn } from '@/lib/utils';

export type LineOfBusiness = 'PROPERTY' | 'EB';

const LINES = [
  {
    value: 'PROPERTY',
    label: 'Property',
    hint: 'Fire, burglary and the other property sections, by risk location.',
    icon: Building2,
  },
  {
    value: 'EB',
    label: 'Employee Benefits',
    hint: 'Group health (GMC), group personal accident (GPA) and group term life (GTLI).',
    icon: HeartPulse,
  },
] as const;

/**
 * Chooses the line of business of a new case (Requirement 1.1): Property or Employee Benefits,
 * neither chosen at first. Each line has its own form, so the Property form stays as it is.
 */
export function LineOfBusinessChoice({
  value,
  onChange,
}: {
  value: LineOfBusiness | null;
  onChange: (value: LineOfBusiness) => void;
}) {
  return (
    <fieldset className="mb-6 grid max-w-3xl gap-2 sm:grid-cols-2">
      <legend className="mb-2 text-sm font-medium">Line of business</legend>
      {LINES.map((line) => {
        const checked = value === line.value;
        const Icon = line.icon;
        return (
          <label
            key={line.value}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 focus-within:ring-2 focus-within:ring-ring',
              checked ? 'border-primary bg-primary-soft/40' : 'hover:bg-muted',
            )}
          >
            <input
              type="radio"
              name="line-of-business"
              value={line.value}
              checked={checked}
              onChange={() => onChange(line.value)}
              className="mt-1 accent-[var(--primary)]"
            />
            <Icon aria-hidden="true" className="mt-0.5 size-4 text-primary" />
            <span className="grid gap-0.5">
              <span className="text-sm font-medium">{line.label}</span>
              <span className="text-xs text-muted-foreground">{line.hint}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
