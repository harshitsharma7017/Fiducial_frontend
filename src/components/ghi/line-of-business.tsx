import { Building2, HeartPulse } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const LINES = [
  {
    value: 'PROPERTY',
    href: '/proposals/new',
    label: 'Property',
    hint: 'Fire, burglary and the other property sections, by risk location.',
    icon: Building2,
  },
  {
    value: 'GHI',
    href: '/ghi/new',
    label: 'Group Health',
    hint: 'Group health insurance for a company’s employees and their families.',
    icon: HeartPulse,
  },
] as const;

/**
 * Chooses the line of business of a new case. Each line has its own form and workflow; choosing
 * one opens its form, so the Property form stays exactly as it is.
 */
export function LineOfBusinessSwitch({ current }: { current: 'PROPERTY' | 'GHI' }) {
  return (
    <nav aria-label="Line of business" className="mb-6 grid max-w-3xl gap-2 sm:grid-cols-2">
      {LINES.map((line) => {
        const active = line.value === current;
        const Icon = line.icon;
        return (
          <Link
            key={line.value}
            href={line.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-start gap-3 rounded-md border px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'border-primary bg-primary-soft/40' : 'hover:bg-muted',
            )}
          >
            <Icon aria-hidden="true" className="mt-0.5 size-4 text-primary" />
            <span className="grid gap-0.5">
              <span className="text-sm font-medium">{line.label}</span>
              <span className="text-xs text-muted-foreground">{line.hint}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
