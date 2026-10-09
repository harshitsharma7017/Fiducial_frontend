import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STAGES, STAGE_LABELS, type Stage } from '@/types/proposal';
import { Section } from './section-heading';

/**
 * The stages in order, with everything before the current one marked complete. On a case, each
 * step opens the tab where its work is done.
 */
export function StageStepper({
  stage,
  onSelect,
  selected,
}: {
  stage: Stage;
  /** With it, each step is a button that opens where its work is done. */
  onSelect?: (stage: Stage) => void;
  /** The step whose work is shown below, marked for the reader. */
  selected?: Stage;
}) {
  const currentIndex = STAGES.indexOf(stage);

  return (
    <Section title="Progress">
      <ol className="flex items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {STAGES.map((value, index) => {
          const done = index < currentIndex;
          const current = index === currentIndex;
          return (
            <li key={value} className="flex min-w-0 shrink-0 items-center gap-1">
              <Step
                onClick={onSelect ? () => onSelect(value) : undefined}
                aria-current={current ? 'step' : undefined}
                aria-pressed={onSelect ? selected === value : undefined}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap',
                  current && 'border-primary bg-primary-soft font-medium text-primary',
                  done && 'border-transparent bg-success-soft text-success',
                  !current && !done && 'border-border text-muted-foreground',
                  onSelect &&
                    'cursor-pointer outline-none hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring',
                  onSelect && selected === value && 'ring-1 ring-primary/40',
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
              </Step>
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

/** A step: a button when it opens a tab, else plain text. */
function Step({
  onClick,
  children,
  ...props
}: React.ComponentProps<'span'> & { onClick?: () => void }) {
  return onClick ? (
    <button type="button" onClick={onClick} {...(props as React.ComponentProps<'button'>)}>
      {children}
    </button>
  ) : (
    <span {...props}>{children}</span>
  );
}
