import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STAGES, STAGE_LABELS, type Stage } from '@/types/proposal';
import { Section } from './section-heading';

/** The six stages in order, with everything up to the current one marked complete. */
export function StageStepper({ stage }: { stage: Stage }) {
  const currentIndex = STAGES.indexOf(stage);

  return (
    <Section title="Progress">
      <ol className="flex items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {STAGES.map((value, index) => {
          const done = index < currentIndex;
          const current = index === currentIndex;
          return (
            <li key={value} className="flex min-w-0 shrink-0 items-center gap-1">
              <span
                aria-current={current ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap',
                  current && 'border-primary bg-primary-soft font-medium text-primary',
                  done && 'border-transparent bg-success-soft text-success',
                  !current && !done && 'border-border text-muted-foreground',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-4 items-center justify-center rounded-full text-[10px] tabular',
                    current && 'bg-primary text-primary-foreground',
                    done && 'bg-success text-background',
                    !current && !done && 'bg-muted',
                  )}
                >
                  {done ? <Check className="size-2.5" /> : index + 1}
                </span>
                {STAGE_LABELS[value]}
                {current ? <span className="sr-only"> (current stage)</span> : null}
                {done ? <span className="sr-only"> (completed)</span> : null}
              </span>
              {index < STAGES.length - 1 ? (
                <span aria-hidden="true" className="h-px w-3 bg-border" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
