'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

/**
 * A list of lines (clauses, conditions) the case can add to, edit or remove from: each is printed
 * numbered under its heading on the RFQ and the quote comparison.
 */
export function TextList({
  label,
  items,
  onChange,
  disabled,
  max,
}: {
  /** "Clause" or "Condition", for the buttons and the boxes' names. */
  label: string;
  items: readonly string[];
  onChange: (items: string[]) => void;
  disabled: boolean;
  max: number;
}) {
  return (
    <div className="grid gap-2">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">None. The documents leave the heading out.</p>
      ) : (
        <ol className="grid gap-2">
          {items.map((item, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="w-6 pt-2 text-right text-sm text-muted-foreground tabular">
                {index + 1}.
              </span>
              <Textarea
                aria-label={`${label} ${index + 1}`}
                rows={2}
                maxLength={1000}
                disabled={disabled}
                value={item}
                onChange={(event) =>
                  onChange(items.map((other, at) => (at === index ? event.target.value : other)))
                }
              />
              {disabled ? null : (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}
                  onClick={() => onChange(items.filter((_other, at) => at !== index))}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}
      {disabled ? null : (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={items.length >= max}
            onClick={() => onChange([...items, ''])}
          >
            <Plus aria-hidden="true" />
            Add {label.toLowerCase()}
          </Button>
        </div>
      )}
    </div>
  );
}
