'use client';

import { useLayoutEffect, useRef, type ComponentProps, type Ref } from 'react';
import { Input } from '@/components/ui/input';
import {
  formatAmountForInput,
  positionAfterSignificant,
  sanitiseAmount,
  significantCharactersBefore,
} from '@/lib/amount-input';
import { cn } from '@/lib/utils';

type SumInsuredInputProps = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'ref'> & {
  /** The plain amount, for example "100000000" or "2500000.50". */
  value: string;
  onValueChange: (value: string) => void;
  ref?: Ref<HTMLInputElement>;
};

/**
 * Rupee amount input that shows Indian digit grouping as you type (10,00,00,000) while the
 * form keeps the plain string. The caret stays after the same digit when commas move.
 */
export function SumInsuredInput({
  value,
  onValueChange,
  ref,
  className,
  ...props
}: SumInsuredInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const caret = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (caret.current !== null && inputRef.current && document.activeElement === inputRef.current) {
      inputRef.current.setSelectionRange(caret.current, caret.current);
    }
    caret.current = null;
  });

  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute top-2 left-3 text-muted-foreground"
        aria-hidden="true"
      >
        ₹
      </span>
      <Input
        {...props}
        ref={(node) => {
          inputRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        className={cn('tabular pl-7', className)}
        inputMode="decimal"
        autoComplete="off"
        value={formatAmountForInput(value)}
        onChange={(event) => {
          const text = event.target.value;
          const position = event.target.selectionStart ?? text.length;
          const significant = significantCharactersBefore(text, position);
          const next = sanitiseAmount(text);
          caret.current = positionAfterSignificant(formatAmountForInput(next), significant);
          onValueChange(next);
        }}
      />
    </div>
  );
}
